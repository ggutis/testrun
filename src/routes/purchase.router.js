import express from 'express';
import { prisma } from '../utils/prisma/index.js';
import authMiddleware from '../middlewares/auth.middleware.js';
import { Prisma } from '@prisma/client';

const router = express.Router();

router.post('/character/:characterId/purchase', authMiddleware, async (req, res, next) => {
  try {
    const { accountId } = req.user;
    const { characterId } = req.params;
    const { item_code, count = 1 } = req.body;

    if (!item_code || count <= 0) {
      return res.status(400).json({ message: '유효한 아이템과 수량을 입력해주세요.' });
    }

    const item = await prisma.items.findUnique({
      where: { item_code: +item_code },
    });

    if (!item) {
      return res.status(404).json({ message: '존재하지 않는 아이템입니다.' });
    }

    const character = await prisma.character.findFirst({
      where: {
        characterId: +characterId,
        accountId: +accountId,
      },
    });

    if (!character) {
      return res.status(403).json({ message: '자신의 캐릭터로만 아이템을 구매할 수 있습니다.' });
    }

    const totalPrice = item.item_price * +count;
    if (character.money < totalPrice) {
      return res.status(400).json({ message: '소지금이 부족합니다.' });
    }

    await prisma.$transaction(
      async (tx) => {
        await tx.character.update({
          where: { characterId: +characterId },
          data: { money: { decrement: totalPrice } },
        });

        const existingInventoryItem = await tx.inventory.findFirst({
          where: {
            characterId: +characterId,
            item_code: item.item_code,
          },
        });

        if (existingInventoryItem) {
          await tx.inventory.update({
            where: {
              invenId: existingInventoryItem.invenId,
            },
            data: {
              count: { increment: +count },
            },
          });
        } else {
          await tx.inventory.create({
            data: {
              characterId: +characterId,
              item_code: item.item_code,
              count: +count,
            },
          });
        }
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );

    const updatedCharacter = await prisma.character.findUnique({
      where: { characterId: +characterId },
    });

    return res.status(200).json({
      message: `${item.item_name} ${count}개를 구매하였습니다.`,
      구매금액: totalPrice,
      남은금액: updatedCharacter.money,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
