import express from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma/index.js';

const router = express.Router();

/** 엑세스 토큰 검증 API **/
router.get('/token/validate', async (req, res) => {
  const accessToken = req.cookies.accessToken;

  if (!accessToken) {
    return res.status(400).json({ message: 'Access Token이 존재하지 않습니다.' });
  }

  const payload = validateToken(accessToken, process.env.ACCESS_TOKEN_SECRET_KEY);

  if (!payload) {
    return res.status(401).json({ message: 'Access Token이 유효하지 않습니다.' });
  }

  const { accountId } = payload;
  return res.json({ message: `${accountId}의 payload를 가진 Token이 성공적으로 인증되었습니다.` });
});

/**Token을 검증하고 Payload를 반환합니다. **/
function validateToken(token, secretKey) {
  try {
    const payload = jwt.verify(token, secretKey);
    return payload;
  } catch (error) {
    return null;
  }
}

/** 리프레시 토큰 검증 API **/
router.post('/token/refresh', async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ message: 'Refresh Token이 존재하지 않습니다.' });
  }

  //Token 검증
  try {
    const payload = validateToken(refreshToken, process.env.REFRESH_TOKEN_SECRET_KEY);
    if (!payload) {
      return res.status(401).json({ errorMessage: 'Refresh Token이 유효하지 않습니다.' });
    }

    const savedToken = await prisma.refreshToken.findUnique({
      where: { accountId: payload.accountId },
    });

    if (!savedToken) {
      return res.status(419).json({ message: 'Refresh Token의 정보가 서버에 존재하지 않습니다.' });
    }

    const newAccessToken = jwt.sign(
      { accountId: payload.accountId },
      process.env.ACCESS_TOKEN_SECRET_KEY,
      { expiresIn: '15m' },
    );

    res.cookie('accessToken', newAccessToken);
    return res.json({ message: 'Access Token을 새롭게 발급하였습니다.' });
  } catch (err) {
    return res.status(403).json({ message: 'Refresh Token이 유효하지 않거나 만료되었습니다.' });
  }
});

export default router;
