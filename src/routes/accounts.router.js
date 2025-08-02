import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma/index.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = express.Router();

/** 사용자 회원가입 API **/
router.post('/sign-up', async (req, res, next) => {
  try {
    const { userId, password, confirmPassword } = req.body;
    const userIdRegex = /^[a-z0-9]+$/;
    const containsLetter = /[a-z]/.test(userId);
    const containsNumber = /[0-9]/.test(userId);

    if (!userIdRegex.test(userId)) {
      return res.status(400).json({
        message: '아이디는 영어 소문자와 숫자만 사용할 수 있습니다.',
      });
    }

    if (!containsLetter || !containsNumber) {
      return res.status(400).json({
        message: '아이디는 영어 소문자와 숫자를 모두 포함해야 합니다.',
      });
    }

    const isExisAccount = await prisma.accounts.findFirst({
      where: {
        userId,
      },
    });

    if (password.length < 6) {
      return res.status(400).json({ message: '비밀번호는 최소 6자 이상이어야 합니다.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: '비밀번호가 일치하지 않습니다.' });
    }

    if (isExisAccount) {
      return res.status(409).json({ message: '이미 존재하는 계정입니다.' });
    }

    // 사용자 비밀번호를 암호화
    const hashedPassword = await bcrypt.hash(password, 10);

    // account 테이블에 계정 추가
    await prisma.accounts.create({
      data: {
        userId,
        password: hashedPassword,
      },
      select: {
        accountId: true,
        userId: true,
        createdAt: true,
      },
    });

    return res.status(201).json({ message: '회원가입이 완료되었습니다.' });
  } catch (err) {
    next(err);
  }
});

/** 로그인 API **/
router.post('/sign-in', async (req, res, next) => {
  try {
    const { userId, password } = req.body;
    const user = await prisma.accounts.findFirst({ where: { userId } });

    if (!user) {
      return res.status(401).json({ message: '존재하지 않는 계정입니다.' });
    }
    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: '비밀번호가 일치하지 않습니다.' });
    }

    // Access Token 생성
    const accessToken = jwt.sign(
      { accountId: user.accountId },
      process.env.ACCESS_TOKEN_SECRET_KEY,
      { expiresIn: '1h' },
    );

    // Refresh Token 생성
    const refreshToken = jwt.sign(
      { accountId: user.accountId },
      process.env.REFRESH_TOKEN_SECRET_KEY,
      { expiresIn: '1d' },
    );

    await prisma.refreshToken.upsert({
      where: { accountId: user.accountId },
      update: {
        token: refreshToken,
      },
      create: {
        accountId: user.accountId,
        token: refreshToken,
      },
    });

    res.cookie('accessToken', accessToken); // Access Token을 Cookie에 전달한다.
    res.cookie('refreshToken', refreshToken); // Refresh Token을 Cookie에 전달한다.
    return res.status(200).json({
      message: '로그인에 성공했습니다.',
      accessToken: accessToken,
      refreshToken: refreshToken,
    });
  } catch (err) {
    next(err);
  }
});

/** 계정 조회(관리자용) API **/

router.get('/account', authMiddleware, async (req, res, next) => {
  const { userId } = req.user;

  const account = await prisma.accounts.findUnique({
    where: { userId: userId },
    select: {
      accountId: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
      characters: true,
    },
  });

  return res.status(200).json({ data: account });
});

export default router;
