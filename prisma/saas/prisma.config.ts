import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";

export default defineConfig({
  schema: "./schema.prisma",
  datasource: {
    url: process.env.SAAS_DATABASE_URL!,
  },
});
