declare module "cors";
declare module "cookie-parser";
declare module "bcrypt";
declare module "jsonwebtoken";
declare module "multer";
declare namespace Express { interface Request { cookies?: Record<string, string>; file?: { buffer: Buffer; mimetype: string; originalname: string; size: number } } }
