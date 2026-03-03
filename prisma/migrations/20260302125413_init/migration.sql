-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mindmaps" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Untitled',
    "viewport_x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "viewport_y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "viewport_zoom" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mindmaps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mindmap_nodes" (
    "id" UUID NOT NULL,
    "mindmap_id" UUID NOT NULL,
    "parent_id" UUID,
    "sort_index" INTEGER NOT NULL DEFAULT 0,
    "position_x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "position_y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL DEFAULT '',
    "collapsed" BOOLEAN NOT NULL DEFAULT false,
    "style_json" JSONB,
    "note_doc" JSONB,
    "note_plain" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mindmap_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mindmap_edges" (
    "id" UUID NOT NULL,
    "mindmap_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "target_id" UUID NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'default',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mindmap_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "node_id" UUID NOT NULL,
    "bucket" TEXT NOT NULL DEFAULT 'mindmap',
    "object_key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mindmap_versions" (
    "id" UUID NOT NULL,
    "mindmap_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL,
    "snapshot_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,

    CONSTRAINT "mindmap_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "mindmap_nodes_mindmap_id_parent_id_sort_index_idx" ON "mindmap_nodes"("mindmap_id", "parent_id", "sort_index");

-- AddForeignKey
ALTER TABLE "mindmaps" ADD CONSTRAINT "mindmaps_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mindmap_nodes" ADD CONSTRAINT "mindmap_nodes_mindmap_id_fkey" FOREIGN KEY ("mindmap_id") REFERENCES "mindmaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mindmap_nodes" ADD CONSTRAINT "mindmap_nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "mindmap_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mindmap_edges" ADD CONSTRAINT "mindmap_edges_mindmap_id_fkey" FOREIGN KEY ("mindmap_id") REFERENCES "mindmaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mindmap_edges" ADD CONSTRAINT "mindmap_edges_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "mindmap_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mindmap_edges" ADD CONSTRAINT "mindmap_edges_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "mindmap_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "mindmap_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mindmap_versions" ADD CONSTRAINT "mindmap_versions_mindmap_id_fkey" FOREIGN KEY ("mindmap_id") REFERENCES "mindmaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mindmap_versions" ADD CONSTRAINT "mindmap_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
