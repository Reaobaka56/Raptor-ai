import { betterAuth } from "better-auth";
import { dash } from "@better-auth/infra";

export const auth = betterAuth({
  basePath: "/api/auth",
  // TODO: configure your database connection and JWT secret
  // db: { provider: "postgres", url: process.env.DATABASE_URL },
  // jwt: { secret: process.env.JWT_SECRET },
  plugins: [dash()],
});
