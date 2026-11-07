/*
  Warnings:

  - You are about to drop the column `copyRight` on the `ApodCache` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ApodCache" DROP COLUMN "copyRight",
ADD COLUMN     "copyright" TEXT;
