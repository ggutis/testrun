import express from 'express';
import { prisma } from '../utils/prisma/index.js';
import { Prisma } from '@prisma/client';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/character/:characterId/sales', authMiddleware, async (req, res, next) => {
  try {
    const { accountId } = req.user;
    const { characterId } = req.params;
    const { item_code, count = 1 } = req.body;

    // 유효성 검사
    if (!item_code || count <= 0) {
      return res.status(400).json({ message: '유효한 item_code와 count를 입력해주세요.' });
    }

    // 아이템 존재 확인
    const item = await prisma.items.findUnique({
      where: { item_code: +item_code },
    });

    if (!item) {
      return res.status(404).json({ message: '존재하지 않는 아이템입니다.' });
    }

    // 캐릭터 소유 확인
    const character = await prisma.character.findFirst({
      where: {
        characterId: +characterId,
        accountId: accountId,
      },
    });

    if (!character) {
      return res.status(403).json({ message: '자신의 캐릭터로만 판매할 수 있습니다.' });
    }

    // 인벤토리 확인
    const inventoryItem = await prisma.inventory.findFirst({
      where: {
        characterId: +characterId,
        itemId: item.itemId,
      },
    });

    if (!inventoryItem || inventoryItem.count < count) {
      return res.status(400).json({ message: '인벤토리에 판매 가능한 수량의 아이템이 없습니다.' });
    }

    // 장착 여부 확인
    const equipped = await prisma.characterItems.findFirst({
      where: {
        characterId: +characterId,
        itemId: item.itemId,
      },
    });

    if (equipped) {
      return res.status(400).json({ message: '장착 중인 아이템은 판매할 수 없습니다.' });
    }

    // 판매가 계산 (정가의 60%)
    const gain = Math.floor(item.item_price * 0.6 * count);

    // 트랜잭션 처리
    await prisma.$transaction(
      async (tx) => {
        // 게임 머니 증가
        await tx.character.update({
          where: { characterId: +characterId },
          data: { money: { increment: gain } },
        });

        if (inventoryItem.count > count) {
          // 수량 차감
          await tx.inventory.update({
            where: { invenId: inventoryItem.invenId },
            data: { count: { decrement: count } },
          });
        } else {
          // 수량 전부 판매한 경우 삭제
          await tx.inventory.delete({
            where: { invenId: inventoryItem.invenId },
          });
        }
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );

    // 변경된 머니 조회
    const updated = await prisma.character.findUnique({
      where: { characterId: +characterId },
      select: { money: true },
    });

    return res.status(200).json({
      message: `${item.item_name} ${count}개를 판매하였습니다.`,
      판매금액: gain,
      남은금액: updated.money,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
