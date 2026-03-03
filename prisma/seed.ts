import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import argon2 from "argon2";

const connectionString =
    process.env.DATABASE_URL ?? "postgresql://app:app@localhost:5432/mindmap";

async function main() {
    const pool = new pg.Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    console.log("🌱 Seeding database...");

    // Create demo user
    const passwordHash = await argon2.hash("demo123");
    const user = await prisma.user.upsert({
        where: { email: "demo@mindmap.dev" },
        update: {},
        create: {
            email: "demo@mindmap.dev",
            passwordHash,
        },
    });
    console.log(`  ✅ User: ${user.email} (id: ${user.id})`);

    // Create a sample mindmap
    const map = await prisma.mindmap.create({
        data: {
            ownerId: user.id,
            title: "Getting Started",
        },
    });
    console.log(`  ✅ Mindmap: ${map.title} (id: ${map.id})`);

    // Create root node
    const root = await prisma.mindmapNode.create({
        data: {
            mindmapId: map.id,
            title: "Getting Started",
            sortIndex: 0,
            positionX: 0,
            positionY: 0,
        },
    });

    // Create child nodes
    const children = [
        { title: "Create your first map", sortIndex: 0 },
        { title: "Add child nodes", sortIndex: 1 },
        { title: "Drag to rearrange", sortIndex: 2 },
        { title: "Share with team", sortIndex: 3 },
    ];

    const childNodes = [];
    for (const child of children) {
        const node = await prisma.mindmapNode.create({
            data: {
                mindmapId: map.id,
                parentId: root.id,
                title: child.title,
                sortIndex: child.sortIndex,
                positionX: 250,
                positionY: child.sortIndex * 80 - 120,
            },
        });
        childNodes.push(node);
    }

    // Create edges
    for (const child of childNodes) {
        await prisma.mindmapEdge.create({
            data: {
                mindmapId: map.id,
                sourceId: root.id,
                targetId: child.id,
                type: "default",
            },
        });
    }

    console.log(`  ✅ Created ${children.length} nodes + edges`);
    console.log("\n🎉 Seed complete!");
    console.log("   Login: demo@mindmap.dev / demo123\n");

    await pool.end();
}

main().catch(console.error);
