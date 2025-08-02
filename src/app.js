import express from 'express';
import cookieParser from 'cookie-parser';
import LogMiddleware from './middlewares/log.middleware.js';
import ErrorHandlingMiddleware from './middlewares/error-handling.middleware.js';
import dotenv from 'dotenv';
import AccountsRouter from './routes/accounts.router.js';
import CharacterRouter from './routes/character.router.js';
import ItemRouter from './routes/item.router.js';
import PurchaseRouter from './routes/purchase.router.js';
import SaleRouter from './routes/sale.router.js';
import TokensRouter from './routes/tokens.router.js';
import InventoriesRouter from './routes/inventories.router.js';
import EquipmentRouter from './routes/equipement.router.js';

dotenv.config();

const app = express();
const PORT = 3018;

// const ACCESS_TOKEN_SECRET_KEY = process.env.ACCESS_TOKEN_SECRET_KEY;
// const REFRESH_TOKEN_SECRET_KEY = process.env.REFRESH_TOKEN_SECRET_KEY;

app.use(LogMiddleware);
app.use(express.json());
app.use(cookieParser());

// 라우터 등록
app.use('/api', [
  AccountsRouter,
  CharacterRouter,
  ItemRouter,
  TokensRouter,
  PurchaseRouter,
  SaleRouter,
  InventoriesRouter,
  EquipmentRouter,
]);

// 에러 핸들링 미들웨어
app.use(ErrorHandlingMiddleware);

app.listen(PORT,'0.0.0.0', () => {
  console.log(PORT, '포트로 서버가 열렸어요!');
});
