import express from 'express';
import { prisma } from '../utils/prisma/index.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = express.Router();

/**캐릭터 생성 api */
router.post('/characters', authMiddleware, async (req, res, next) => {
  try {
    const { charactername } = req.body;
    const { accountId } = req.user; // authMiddleware에서 넣어준 로그인 계정 ID

    // 1. 캐릭터 이름 중복여부 검증
    const isExisCharacter = await prisma.character.findFirst({
      where: { charactername },
    });

    if (!charactername) {
      return res.status(400).json({ message: '캐릭터 이름을 입력해주세요.' });
    }

    if (isExisCharacter) {
      return res.status(409).json({ message: '이미 존재하는 캐릭터 이름입니다.' });
    }

    // 2. 현재 계정의 캐릭터 수 조회
    const characterCount = await prisma.character.count({
      where: { accountId },
    });

    const MAX_CHARACTERS = 3; // 생성 가능 최대 캐릭터 수

    if (characterCount >= MAX_CHARACTERS) {
      return res.status(400).json({
        message: `캐릭터 생성 한도 초과: 최대 ${MAX_CHARACTERS}개까지 생성 가능합니다.`,
      });
    }

    // 3. 캐릭터 생성
    const newCharacter = await prisma.character.create({
      data: {
        charactername,
        accountId,
      },
      select: {
        characterId: true,
        charactername: true,
        hp: true,
        mp: true,
        attack: true,
        defense: true,
        dexterity: true,
        speed: true,
        money: true,
        createdAt: true,
      },
    });

    return res.status(201).json({ message: '캐릭터 생성 완료', data: newCharacter });
  } catch (error) {
    next(err);
  }
});

/**캐릭터 삭제 api*/
router.delete('/character/:charactername', authMiddleware, async (req, res , next) => {
  try {
    const { charactername } = req.params;
    const { accountId } = req.user;

    console.log(accountId);
    // 해당 유저의 캐릭터 중에서 이름이 일치하는 캐릭터 찾기
    const character = await prisma.character.findFirst({
      where: {
        charactername,
        accountId,
      },
    });

    if (!character) {
      return res.status(404).json({
        message: '해당 캐릭터가 존재하지 않거나 권한이 없습니다.',
      });
    }

    // 캐릭터 삭제
    await prisma.character.delete({
      where: {
        characterId: character.characterId,
      },
    });

    return res.status(200).json({ message: '캐릭터가 성공적으로 삭제되었습니다.' });
  } catch (error) {
    next(err);
  }
});

/** 캐릭터 상세 조회 api */
router.get('/character/:characterId', authMiddleware, async (req, res, next) => {
  try {
    const { characterId } = req.params;
    const { accountId } = req.user;

    const character = await prisma.character.findUnique({
      where: { characterId: +characterId },
      select: {
        accountId: true,
        charactername: true,
        hp: true,
        mp: true,
        attack: true,
        defense: true,
        dexterity: true,
        speed: true,
        money: true,
      },
    });

    if (!character) {
      return res.status(404).json({ message: '캐릭터를 찾을 수 없습니다.' });
    }

    // 내 캐릭터인지 확인
    const isMyCharacter = accountId && character.accountId === accountId;

    const responseData = {
      charactername: character.charactername,
      hp: character.hp,
      mp: character.mp,
      attack: character.attack,
      defense: character.defense,
      dexterity: character.dexterity,
      speed: character.speed,
      ...(isMyCharacter && { money: character.money }),
    };

    return res.status(200).json(responseData);
  } catch (error) {
    next(err);
  }
});

/** 돈버는 api **/
router.patch('/character/:characterId/addMoney', authMiddleware, async (req, res, next) => {
  const { characterId } = req.params;
  const { accountId } = req.user;

  if (!accountId) {
    return res.status(400).json({ message: 'accountId가 올바르지 않습니다.' });
  }
  try {
    const character = await prisma.character.findFirst({
      where: {
        characterId: +characterId,
        accountId: +accountId,
      },
    });

    if (!character) {
      return res.status(400).json({ message: ' 해당 캐릭터를 찾을 수 없습니다.' });
    }

    const updatedCharacter = await prisma.character.update({
      where: { characterId: +characterId },
      data: {
        money: {
          increment: 100,
        },
      },
    });

    return res.status(200).json({ message: '100원이 추가되었습니다.', data: updatedCharacter });
  } catch (error) {
       next(err);

  }
});

export default router;
