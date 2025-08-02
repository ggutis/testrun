import express from 'express';
import { prisma } from '../utils/prisma/index.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = express.Router();

/** 캐릭터 아이템 장착 api */
router.post('/character/:characterId/equip', authMiddleware, async (req, res, next) => {
  try {
    const { characterId } = req.params;
    const { item_code } = req.body;
    const { accountId } = req.user;

    if (!item_code) {
      return res.status(400).json({ message: '장착할 아이템의 code를 입력해 주세요.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      //1.캐릭터가 내 소유인지 확인
      const character = await tx.character.findUnique({
        where: { characterId: +characterId },
      });

      if (!character || character.accountId !== accountId) {
        throw new Error('캐릭터를 찾을 수 없습니다.');
      }

      //2. 인벤토리에 아이템이 있는지 확인
      const inventoryItem = await tx.inventory.findFirst({
        where: { characterId: +characterId, item_code: +item_code },
      });

      if (!inventoryItem) {
        throw new Error('인벤토리에 해당 아이템이 존재하지 않습니다.');
      }

      //3. 이미 장착한 아이템인지 확인
      const alreadyEquipped = await tx.characterItems.findFirst({
        where: { characterId: +characterId, item_code: +item_code },
      });

      if (alreadyEquipped) {
        throw new Error(' 이미 장착한 아이템입니다.');
      }

      //4. 아이템 정보 조회(스탯 확인)
      const itemEqip = await tx.items.findUnique({
        where: { item_code: +item_code },
      });

      if (!itemEqip) {
        throw new Error('아이템 정보를 찾을 수 없습니다.');
      }

      //5. 아이템 장착
      await tx.characterItems.create({
        data: { characterId: +characterId, item_code: +item_code },
      });

      // 6. 인벤토리에서 아이템 수량 1감소
      const updatedInventory = await tx.inventory.update({
        where: { invenId: inventoryItem.invenId },
        data: {
          count: {
            decrement: 1,
          },
        },
      });

      //7. 인벤토리 수량이 0이되면 삭제
      if (updatedInventory.count === 0) {
        await tx.inventory.delete({
          where: { invenId: updatedInventory.invenId },
        });
      }

      //8. 캐릭터 스탯 업데이트
      const updatedCharacter = await tx.character.update({
        where: { characterId: +characterId },
        data: {
          attack: {
            increment: itemEqip.item_stat.attack || 0,
          },
          defense: {
            increment: itemEqip.item_stat.defense || 0,
          },
          dexterity: {
            increment: itemEqip.item_stat.dexterity || 0,
          },
          speed: {
            increment: itemEqip.item_stat.speed || 0,
          },
          mp: {
            increment: itemEqip.item_stat.mp || 0,
          },
          hp: {
            increment: itemEqip.item_stat.hp || 0,
          },
        },
      });

      return res.status(200).json({
        message: '아이템을 장착했습니다.',
        data: {
          characterId: updatedCharacter.characterId,
          attack: updatedCharacter.attack,
          defense: updatedCharacter.defense,
          dexterity: updatedCharacter.dexterity,
          speed: updatedCharacter.speed,
          mp: updatedCharacter.mp,
          hp: updatedCharacter.hp,
        },
      });
    });
  } catch (error) {
      next(error);
  }
});

/**아이템 탈착 API */

router.post('/character/:characterId/detach', authMiddleware, async (req, res, next) => {
  try {
    const { characterId } = req.params;
    const { item_code } = req.body;
    const { accountId } = req.user;

    if (!item_code) {
      return res.status(400).json({ message: '장착 해제할 아이템의 code를 입력해 주세요.' });
    }

    const updatedCharacter = await prisma.$transaction(async (tx) => {
      // 1. 캐릭터가 내 소유인지 확인
      const character = await tx.character.findUnique({
        where: { characterId: +characterId },
      });

      if (!character || character.accountId !== accountId) {
        throw new Error('캐릭터를 찾을 수 없습니다.');
      }

      // 2. 장착 아이템에 아이템이 있는지 확인
      const equippedItem = await tx.characterItems.findFirst({
        where: { characterId: +characterId, item_code: +item_code },
      });

      if (!equippedItem) {
        throw new Error('장착중인 아이템이 아닙니다.');
      }

      // 3. 아이템 정보 조회(스탯 확인)
      const itemToDetach = await tx.items.findUnique({
        where: { item_code: +item_code },
      });

      if (!itemToDetach) {
        throw new Error('아이템 정보를 찾을 수 없습니다.');
      }

      // 4. 아이템 탈착
      await tx.characterItems.delete({
        where: {
          characterItemId: equippedItem.characterItemId,
        },
      });

      // 5. 인벤토리에 아이템이 있는지 확인
      const inventoryItem = await tx.inventory.findFirst({
        where: {
          characterId: +characterId,
          item_code: +item_code,
        },
      });

      if (inventoryItem) {
        // 6. 인벤토리에 아이템이 있으면 수량 1 증가
        await tx.inventory.update({
          where: {
            invenId: inventoryItem.invenId,
          },
          data: {
            count: {
              increment: 1,
            },
          },
        });
      } else {
        // 7. 인벤토리에 아이템이 없으면 새로 추가
        await tx.inventory.create({
          data: {
            characterId: +characterId,
            item_code: +item_code,
            count: 1,
          },
        });
      }

      // 8. 캐릭터 스탯 업데이트
      const finalUpdatedCharacter = await tx.character.update({
        where: { characterId: +characterId },
        data: {
          attack: {
            decrement: itemToDetach.item_stat.attack || 0,
          },
          defense: {
            decrement: itemToDetach.item_stat.defense || 0,
          },
          dexterity: {
            decrement: itemToDetach.item_stat.dexterity || 0,
          },
          speed: {
            decrement: itemToDetach.item_stat.speed || 0,
          },
          mp: {
            decrement: itemToDetach.item_stat.mp || 0,
          },
          hp: {
            decrement: itemToDetach.item_stat.hp || 0,
          },
        },
      });

      return finalUpdatedCharacter;
    });

    return res.status(200).json({
      message: '아이템을 햐재했습니다.',
      data: {
        characterId: updatedCharacter.characterId,
        attack: updatedCharacter.attack,
        defense: updatedCharacter.defense,
        dexterity: updatedCharacter.dexterity,
        speed: updatedCharacter.speed,
        mp: updatedCharacter.mp,
        hp: updatedCharacter.hp,
      },
    });
  } catch (error) {
    next(error);

  }
});

export default router;
