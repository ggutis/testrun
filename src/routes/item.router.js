import express from 'express';
import { prisma } from '../utils/prisma/index.js';
import { Prisma } from '@prisma/client';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = express.Router();

/** 아이템 생성 API **/
router.post('/items', async (req, res, next) => {
  try {
    const { item_code, item_name, item_price, item_stat, item_type, description, rarity } =
      req.body;

    if (!item_code || !item_name) {
      return res.status(400).json({
        message: 'item_code와 item_name은 필수 입력 항목입니다.',
      });
    }

    const newItemData = {
      item_code: +item_code,
      item_name,
      item_price: item_price !== undefined ? +item_price : 1,
      item_stat: item_stat || {},
      item_type: item_type || 'ETC',
      description: description || null,
      rarity: (rarity || 'common').toLowerCase(),
    };

    const validRarities = ['common', 'rare', 'epic', 'legendary'];

    if (!validRarities.includes(newItemData.rarity)) {
      return res.status(400).json({
        message: `휘귀도는 다음중 하나여야 합니다:${validRarities.join(',')}`,
      });
    }

    const newItem = await prisma.items.create({
      data: newItemData,
    });

    return res.status(202).json({
      message: '아이템이 성공적으로 생성되었습니다.',
      data: newItem,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: '이미 존재하는 item_code입니다.' });
    }
    next(error);
  }
});

/** 아이템 목록 조회 API **/
router.get('/items', async (req, res, next) => {
  console.log('GET /items 요청 들어옴'); // 추가
  try {
    const items = await prisma.items.findMany({
      select: {
        item_code: true,
        item_name: true,
        item_price: true,
      },
      orderBy: {
        item_code: 'asc', // 정렬은 필요에 따라 조절
      },
    });

    return res.status(200).json({ items });
  } catch (error) {
     next(err);

  }
});

/** 아이템 상세 조회 API **/
router.get('/items/:item_code', async (req, res, next) => {
  try {
    const { item_code } = req.params;

    if (isNaN(item_code)) {
      return res.status(400).json({ message: '유효한 아이템 코드가 아닙니다.' });
    }

    const item = await prisma.items.findUnique({
      where: { item_code: +item_code },
      select: {
        item_code: true,
        item_name: true,
        item_price: true,
        item_stat: true,
        item_type: true,
        description: true,
        rarity: true,
      },
    });

    if (!item) {
      return res.status(400).json({ message: '해당 아이템을 찾을수 없습니다.' });
    }

    return res.status(200).json(item);
  } catch (error) {
    next(error);
  }
});

/**아이템 정보 수정 **/
router.patch('/items/:item_code', async (req, res, next) => {
  try {
    const { item_code } = req.params;
    const updateData = req.body;

    // item_price가 요청에 포함되어 있더라도, 수정되지 않도록 삭제합니다.
    if (updateData.item_price) {
      delete updateData.item_price;
    }

    const item = await prisma.items.findUnique({
      where: { item_code: +item_code },
    });

    // 아이템이 존재하지 않을 경우 에러 처리
    if (!item) {
      return res.status(404).json({ message: '해당 아이템을 찾을 수 없습니다.' });
    }

    const updatedItem = await prisma.$transaction(
      async (tx) => {
        // 아이템 정보 업데이트
        const updated = await tx.items.update({
          data: {
            ...updateData,
          },
          where: {
            item_code: item.item_code,
          },
        });

        // 변경 내역 기록
        for (let key in updateData) {
          if (item[key] !== updateData[key]) {
            await tx.itemHistories.create({
              data: {
                item_code: item.item_code,
                changedField: key,
                oldValue: String(item[key]),
                newValue: String(updateData[key]),
              },
            });
          }
        }
        // 트랜잭션의 결과로 업데이트된 아이템을 반환
        return updated;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );

    return res.status(200).json({
      message: '아이템 정보를 변경하였습니다.',
      data: item,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
