import express from 'express';
import { prisma } from '../utils/prisma/index.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = express.Router();

/**캐릭터 인벤토리 내 아이템 확인 api */
router.get('/character/:characterId/inventory', authMiddleware, async (req, res, next) => {
  try {
    const { characterId } = req.params;
    const { accountId } = req.user;

    //캐릭터 존재여부 확인
    const character = await prisma.character.findFirst({
      where: {
        characterId: +characterId,
        accountId: +accountId,
      },
    });

    if (!character) {
      return res.status(404).json({ message: '캐릭터를 찾울 수 없습니다.' });
    }

    //인벤토리 조회
    const inventory = await prisma.inventory.findMany({
      where: {
        characterId: +characterId,
      },
      select: {
        invenId: true,
        count: true,
        items: {
          select: {
            item_code: true,
            item_name: true,
            item_type: true,
            item_stat: true,
          },
        },
      },
    });

    if (!inventory || inventory.length === 0) {
      return res.status(200).json({ message: '인벤토리에 아이템이 없습니다.', data: [] });
    }

    //응답 데이터 형식
    const data = inventory.map((inv) => ({
      invenId: inv.invenId,
      item_code: inv.items.item_code,
      item_name: inv.items.item_name,
      count: inv.count,
      item_stat: inv.items.item_stat,
      item_type: inv.items.item_type,
    }));

    return res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
});

/** 캐릭터가 장착한 아이템 목록 조회 api */
router.get('/character/:characterId/characterItem', async (req, res, next) => {
  const { characterId } = req.params;

  const character = await prisma.character.findFirst({
    where: {
      characterId: +characterId,
    },
  });

  if (!character) {
    return res.status(404).json({ message: '캐릭터를 찾울 수 없습니다.' });
  }

  const characterItems = await prisma.characterItems.findMany({
    where: {
      characterId: +characterId,
    },
    select: {
      characterItemId: true,
      items: {
        select: {
          item_code: true,
          item_name: true,
          item_type: true,
          item_stat: true,
        },
      },
    },
  });
  return res.status(200).json({ data: characterItems });
});

export default router;
