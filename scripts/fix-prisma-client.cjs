const fs = require("fs");
const path = require("path");

const exists = (targetPath) => {
    try {
        fs.accessSync(targetPath, fs.constants.F_OK);
        return true;
    } catch {
        return false;
    }
};

const findGeneratedClientPath = (rootDir) => {
    const direct = path.join(rootDir, "node_modules", ".prisma", "client");
    if (exists(path.join(direct, "index.d.ts"))) {
        return direct;
    }

    const pnpmDir = path.join(rootDir, "node_modules", ".pnpm");
    if (!exists(pnpmDir)) return null;

    const packageDirs = fs.readdirSync(pnpmDir, { withFileTypes: true });
    for (const pkgDir of packageDirs) {
        if (!pkgDir.isDirectory()) continue;

        const candidate = path.join(
            pnpmDir,
            pkgDir.name,
            "node_modules",
            ".prisma",
            "client"
        );

        if (exists(path.join(candidate, "index.d.ts"))) {
            return candidate;
        }
    }

    return null;
};

const main = () => {
    const rootDir = process.cwd();
    const prismaClientRoot = path.join(rootDir, "node_modules", "@prisma", "client");
    const targetClientDir = path.join(prismaClientRoot, ".prisma", "client");

    if (exists(path.join(targetClientDir, "index.d.ts"))) {
        console.log("Prisma client fix: .prisma client already present.");
        return;
    }

    const generatedClientDir = findGeneratedClientPath(rootDir);
    if (!generatedClientDir) {
        console.warn("Prisma client fix: generated .prisma client not found.");
        return;
    }

    fs.mkdirSync(path.dirname(targetClientDir), { recursive: true });
    fs.cpSync(generatedClientDir, targetClientDir, {
        recursive: true,
        force: true,
    });

    console.log("Prisma client fix: copied generated client to @prisma/client/.prisma.");
};

main();
