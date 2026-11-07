-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "firstName" TEXT,
    "userName" TEXT,
    "languageCode" TEXT,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "topic" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApodCache" (
    "date" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "explanationEn" TEXT NOT NULL,
    "titleUz" TEXT,
    "explanationUz" TEXT,
    "mediaType" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "hdUrl" TEXT,
    "copyRight" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApodCache_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "TranslationCache" (
    "id" SERIAL NOT NULL,
    "hash" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "targetLang" TEXT NOT NULL DEFAULT 'uz',
    "result" TEXT NOT NULL,
    "provider" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TranslationCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotifiedEvent" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotifiedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT,
    "thumbUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "User_lastActiveAt_idx" ON "User"("lastActiveAt");

-- CreateIndex
CREATE INDEX "Subscription_topic_idx" ON "Subscription"("topic");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_topic_key" ON "Subscription"("userId", "topic");

-- CreateIndex
CREATE UNIQUE INDEX "TranslationCache_hash_key" ON "TranslationCache"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "NotifiedEvent_externalId_type_key" ON "NotifiedEvent"("externalId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_externalId_source_key" ON "Favorite"("userId", "externalId", "source");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
