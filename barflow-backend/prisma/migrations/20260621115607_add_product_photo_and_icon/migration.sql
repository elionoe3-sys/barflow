-- AlterTable
ALTER TABLE "Categorie" ADD COLUMN     "icon" TEXT;

-- AlterTable
ALTER TABLE "Produit" ADD COLUMN     "photo" TEXT,
ADD COLUMN     "stockCl" DOUBLE PRECISION,
ADD COLUMN     "volumeConfig" JSONB;
