import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";

interface ComparisonResult {
  folderA: string;
  folderB: string;
  uniqueInA: string[];
  common: string[];
  uniqueInB: string[];
  copiedFiles: string[];
  deletedFiles: string[];
  errors: string[];
}

interface CliOptions {
  folderA: string | null;
  folderB: string | null;
  configPath: string | null;
  shouldCopy: boolean;
  syncMode: boolean;
  filterPath: string | null;
}

interface Mapping {
  source: string;
  destinations: string[];
}

interface DistributionConfig {
  mappings: Mapping[];
}

function parseArguments(args: string[]): CliOptions {
  const configIndex = args.indexOf("--config");
  const onlyIndex = args.indexOf("--only");

  let configPath: string | null = null;
  let folderA: string | null = null;
  let folderB: string | null = null;
  let filterPath: string | null = null;

  if (configIndex !== -1 && configIndex + 1 < args.length) {
    configPath = args[configIndex + 1];
  }

  if (onlyIndex !== -1 && onlyIndex + 1 < args.length) {
    filterPath = args[onlyIndex + 1];
  }

  const shouldCopy = !args.includes("--no-copy");
  const syncMode = args.includes("--sync");

  // If no config, expect first two args to be folders
  if (!configPath) {
    folderA = args[0] || null;
    folderB = args[1] || null;
  }

  return {
    folderA,
    folderB,
    configPath,
    shouldCopy,
    syncMode,
    filterPath,
  };
}

/**
 * Recursively delete all contents of a folder (files and subdirectories)
 */
function deleteFolderContentsRecursive(folderPath: string): string[] {
  const deleted: string[] = [];

  try {
    const entries = fs.readdirSync(folderPath);

    for (const entry of entries) {
      const fullPath = path.join(folderPath, entry);
      
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          // Recursively delete subdirectories
          const nestedDeleted = deleteFolderContentsRecursive(fullPath);
          deleted.push(...nestedDeleted);
          fs.rmdirSync(fullPath);
        } else {
          // Delete file
          fs.unlinkSync(fullPath);
          deleted.push(entry);
        }
      } catch (error) {
        console.warn(`Warning: Could not delete ${entry}`);
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not read directory ${folderPath}`);
  }

  return deleted;
}

/**
 * Recursively get all files from a folder and its nested subfolders
 * Returns relative paths from the root folder (e.g., "subfolder/file.txt")
 * Uses iterative approach to avoid deep recursion stack overflow
 */
function getAllFilesRecursive(
  startPath: string,
  relativePath: string = "",
  visitedPaths: Set<string> = new Set(),
  maxDepth: number = 100,
  currentDepth: number = 0
): string[] {
  const allFiles: string[] = [];
  const queue: Array<{folderPath: string; relPath: string; depth: number}> = [
    {folderPath: startPath, relPath: "", depth: 0}
  ];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const {folderPath, relPath, depth} = queue.shift()!;

    // Prevent infinite recursion and limit depth
    if (depth > maxDepth) {
      continue;
    }

    // Prevent circular references
    if (visited.has(folderPath)) {
      continue;
    }
    visited.add(folderPath);

    try {
      const entries = fs.readdirSync(folderPath);

      for (const entry of entries) {
        const fullPath = path.join(folderPath, entry);
        const entRelPath = relPath ? path.join(relPath, entry) : entry;

        try {
          const stat = fs.lstatSync(fullPath);

          if (stat.isFile()) {
            allFiles.push(entRelPath);
          } else if (stat.isDirectory() && !stat.isSymbolicLink()) {
            // Add to queue instead of recursive call
            queue.push({folderPath: fullPath, relPath: entRelPath, depth: depth + 1});
          }
        } catch (error) {
          // Skip individual entries that have issues
          continue;
        }
      }
    } catch (error) {
      // If we can't read the directory, continue with next item
      continue;
    }
  }
  
  return allFiles;
}

async function compareFolders(
  folderA: string,
  folderB: string,
  shouldCopy: boolean = true,
  syncMode: boolean = false,
  filterPath: string | null = null
): Promise<ComparisonResult> {
  const result: ComparisonResult = {
    folderA,
    folderB,
    uniqueInA: [],
    common: [],
    uniqueInB: [],
    copiedFiles: [],
    deletedFiles: [],
    errors: [],
  };

  try {
    // Validate folders exist
    if (!fs.existsSync(folderA)) {
      result.errors.push(`Folder A does not exist: ${folderA}`);
      return result;
    }

    if (!fs.existsSync(folderB)) {
      result.errors.push(`Folder B does not exist: ${folderB}`);
      return result;
    }

    // SYNC MODE: Delete destination first, before any other operations
    if (syncMode) {
      console.log(`Sync mode: Deleting all contents from ${folderB} first...\n`);
      const deleted = deleteFolderContentsRecursive(folderB);
      result.deletedFiles = deleted;
      deleted.forEach((file) => console.log(` Deleted: ${file}`));
      if (deleted.length > 0) {
        console.log();
      }
    }

    // Get list of all files (including nested) from each folder
    console.log(`Scanning source folder (${folderA})...`);
    let filesA = getAllFilesRecursive(folderA);
    console.log(`Found ${filesA.length} files in source folder`);
    
    console.log(`Scanning destination folder (${folderB})...`);
    let filesB = getAllFilesRecursive(folderB);
    console.log(`Found ${filesB.length} files in destination folder`);
    
    // Apply filter if --only flag is used
    if (filterPath) {
      const normalizedFilter = filterPath.replace(/\\/g, '/');
      filesA = filesA.filter(f => {
        const normalized = f.replace(/\\/g, '/');
        return normalized === normalizedFilter || 
               normalized.startsWith(normalizedFilter + '/') ||
               normalizedFilter.startsWith(normalized + '/');
      });
      filesB = filesB.filter(f => {
        const normalized = f.replace(/\\/g, '/');
        return normalized === normalizedFilter || 
               normalized.startsWith(normalizedFilter + '/') ||
               normalizedFilter.startsWith(normalized + '/');
      });
      
      // Only show filtering details if files were found
      if (filesA.length > 0 || filesB.length > 0) {
        console.log(`\nFiltering to only include: ${filterPath}`);
        console.log(`After filtering: ${filesA.length} files in source, ${filesB.length} files in destination\n`);
      } else {
        console.log(`\nNote: No files found matching: ${filterPath}\n`);
      }
    }

    const filesASet = new Set(filesA);
    let filesBSet = new Set(filesB);

    // Find unique and common files
    for (const file of filesA) {
      if (filesBSet.has(file)) {
        result.common.push(file);
      } else {
        result.uniqueInA.push(file);
      }
    }

    for (const file of filesB) {
      if (!filesASet.has(file)) {
        result.uniqueInB.push(file);
      }
    }

    // Copy files from A to B if requested
    // In sync mode: copy all files; otherwise: copy only unique files
    if (shouldCopy) {
      const filesToCopy = syncMode ? filesA : result.uniqueInA;
      if (filesToCopy.length > 0) {
        for (const file of filesToCopy) {
          try {
            const srcPath = path.join(folderA, file);
            const destPath = path.join(folderB, file);
            
            // Create parent directories if they don't exist
            const destDir = path.dirname(destPath);
            if (!fs.existsSync(destDir)) {
              fs.mkdirSync(destDir, { recursive: true });
            }
            
            fs.copyFileSync(srcPath, destPath);
            result.copiedFiles.push(file);
            console.log(`✓ Copied: ${file}`);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            result.errors.push(`Failed to copy ${file}: ${errorMsg}`);
          }
        }
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Comparison error: ${errorMsg}`);
  }

  return result;
}

function printResults(result: ComparisonResult): void {
  console.log("\n" + "=".repeat(60));
  console.log("FOLDER COMPARISON REPORT");
  console.log("=".repeat(60));
  console.log(`Folder A (Source): ${result.folderA}`);
  console.log(`Folder B (Destination): ${result.folderB}`);
  console.log("=".repeat(60));

  if (result.uniqueInA.length > 0) {
    console.log(`\n Unique in Folder A (${result.uniqueInA.length}):`);
    result.uniqueInA.forEach((file) => console.log(`  - ${file}`));
  }

  if (result.common.length > 0) {
    console.log(`\n Common files (${result.common.length}):`);
    if(result.common.length < 5) result.common.forEach((file) => console.log(`  - ${file}`));
  }

  if (result.uniqueInB.length > 0) {
    console.log(`\n Unique in Folder B (${result.uniqueInB.length}):`);
    result.uniqueInB.forEach((file) => console.log(`  - ${file}`));
  }

  if (result.deletedFiles.length > 0) {
    console.log(`\n Deleted files (${result.deletedFiles.length}):`)
    result.deletedFiles.forEach((file) => console.log(`  - ${file}`));
  }

  if (result.copiedFiles.length > 0) {
    console.log(`\n Successfully copied files (${result.copiedFiles.length}):`)
    result.copiedFiles.forEach((file) => console.log(`  - ${file}`));
  }

  if (result.errors.length > 0) {
    console.log(`\n Errors (${result.errors.length}):`);
    result.errors.forEach((error) => console.log(`  - ${error}`));
  }

  console.log("\n" + "=".repeat(60) + "\n");
}

/**
 * Quickly estimate the number of files in folders to determine required stack size
 * Uses sampling to avoid full traversal of huge directories
 */
function estimateFileCount(folderPath: string, maxScanDepth: number = 2, currentDepth: number = 0): number {
  if (currentDepth > maxScanDepth || !fs.existsSync(folderPath)) {
    return 0;
  }

  let count = 0;
  try {
    const entries = fs.readdirSync(folderPath);
    
    for (const entry of entries) {
      const fullPath = path.join(folderPath, entry);
      try {
        const stat = fs.lstatSync(fullPath);
        if (stat.isFile()) {
          count++;
        } else if (stat.isDirectory() && !stat.isSymbolicLink() && currentDepth < maxScanDepth) {
          count += estimateFileCount(fullPath, maxScanDepth, currentDepth + 1);
        }
      } catch (error) {
        // Skip entries that can't be accessed
      }
    }
  } catch (error) {
    // If we can't read the directory, just return current count
  }

  return count;
}

/**
 * Calculate required stack size based on estimated file count
 * More aggressive formula to handle large flat directories (100k+ files)
 * Capped between 1024 MB and 8192 MB
 */
function calculateRequiredStackSize(estimatedFileCount: number): number {
  // More aggressive heuristic for large flat directories
  // Estimate 2 MB per 1000 files for safety
  const baseStack = 1024; // 1024 MB minimum for large directories
  const calculatedStack = baseStack + Math.ceil(estimatedFileCount / 500); // 500 files per MB
  
  // Cap between minimum and maximum reasonable values
  const minStack = 1024; // 1024 MB minimum
  const maxStack = 8192; // 8192 MB maximum
  const requiredStack = Math.max(minStack, Math.min(maxStack, calculatedStack));
  
  return requiredStack;
}

/**
 * Check if we need more stack size and respawn if necessary
 */
async function ensureSufficientStackSize(folderA: string, folderB: string): Promise<boolean> {
  // Quick estimate of file count (sampling first 2 levels only)
  console.log("Analyzing folder structure...");
  const estimatedFilesA = estimateFileCount(folderA, 4);
  const estimatedFilesB = estimateFileCount(folderB, 4);
  const totalEstimated = estimatedFilesA + estimatedFilesB;
  
  const requiredStack = calculateRequiredStackSize(totalEstimated);
  
  // If total estimated files is small, no need for extra stack
  if (totalEstimated < 10000) {
    return false; // No respawn needed
  }
  
  console.log(`Detected approximately ${totalEstimated} files (estimated).`);
  console.log(`Required stack size: ${requiredStack} MB`);
  
  // If we're already running with sufficient stack, continue
  if (process.env.COMPAIR_STACK_SIZE_ADJUSTED === "true") {
    console.log("Already running with optimized stack size.\n");
    return false;
  }
  
  // Detect if running as a pkg executable vs regular Node.js
  const isPackaged = (process as any).pkg !== undefined;
  
  if (isPackaged) {
    // For pkg executables, we cannot respawn with Node.js flags
    // The bundled Node.js should have sufficient memory for most directories
    // Continue processing with available memory
    console.log("Running as standalone executable (pkg). Using available memory.\n");
    return false;
  }
  
  // For regular Node.js, spawn with increased memory
  console.log("Relaunching with optimized memory allocation...\n");
  
  return new Promise((resolve) => {
    const env = { ...process.env, COMPAIR_STACK_SIZE_ADJUSTED: "true" };
    const maxOldSpaceSize = Math.max(2048, requiredStack * 2);
    const memoryArg = `--max-old-space-size=${maxOldSpaceSize}`;
    const stackArg = `--stack-size=${Math.max(4096, requiredStack * 4)}`;
    
    // Spawn with memory arguments
    const isTsNode =
      process.argv[1]?.includes("ts-node") ||
      process.argv[1]?.endsWith(".ts");

    let spawnArgs: string[];

    if (isTsNode) {
      // If running via ts-node, relaunch via ts-node again
      spawnArgs = [
        memoryArg,
        stackArg,
        require.resolve("ts-node/dist/bin.js"),
        process.argv[1],
        ...process.argv.slice(2),
      ];
    } else {
      // Normal JS or pkg
      spawnArgs = [
        memoryArg,
        stackArg,
        ...process.argv.slice(1),
      ];
    }

    const child = spawn(process.execPath, spawnArgs, {
      env,
      stdio: "inherit",
    });
    
    child.on("exit", (code) => {
      process.exit(code || 0);
    });
    
    child.on("error", (err) => {
      console.error("Error during respawn:", err);
      process.exit(1);
    });
    
    resolve(true);
  });
}

async function processConfigMode(
  configPath: string,
  options: CliOptions
): Promise<void> {
  if (!fs.existsSync(configPath)) {
    console.error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  let config: DistributionConfig;

  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    config = JSON.parse(raw);
  } catch {
    console.error("Invalid JSON config file.");
    process.exit(1);
  }

  if (!Array.isArray(config.mappings)) {
    console.error("Invalid config format: 'mappings' must be an array.");
    process.exit(1);
  }

  console.log(`CONFIG MODE: Processing ${config.mappings.length} mapping(s)\n`);

  for (const mapping of config.mappings) {
    const { source, destinations } = mapping;

    if (!source || !Array.isArray(destinations)) {
      console.warn("Skipping invalid mapping entry.");
      continue;
    }

    if (!fs.existsSync(source)) {
      console.warn(`Source does not exist: ${source}`);
      continue;
    }

    const sourceStat = fs.lstatSync(source);
    const isFileSource = sourceStat.isFile();

    for (const dest of destinations) {
      console.log("--------------------------------------------------");
      console.log(`Source      : ${source}`);
      console.log(`Destination : ${dest}`);
      console.log("--------------------------------------------------\n");

      // Determine final destination directory
      const destDir = isFileSource
        ? (path.extname(dest) ? path.dirname(dest) : dest)
        : dest;

      // Ensure destination directory exists
      if (!fs.existsSync(destDir)) {
        console.log(`Creating destination directory: ${destDir}`);
        fs.mkdirSync(destDir, { recursive: true });
      }

      // 🔥 TRUE SYNC BEHAVIOUR (for both file & folder)
      if (options.syncMode) {
        console.log(`Sync mode: Clearing destination directory: ${destDir}`);
        deleteFolderContentsRecursive(destDir);
      }

      // ===============================
      // FILE SOURCE MODE
      // ===============================
      if (isFileSource) {
        const fileName = path.basename(source);
        const finalDest = path.extname(dest)
          ? dest
          : path.join(destDir, fileName);

        if (options.shouldCopy) {
          try {
            fs.copyFileSync(source, finalDest);
            console.log(`✓ Copied file: ${source} → ${finalDest}`);
          } catch (err) {
            console.error(`✗ Failed to copy ${source} → ${finalDest}`);
          }
        } else {
          console.log(`Preview: ${source} → ${finalDest}`);
        }

        continue;
      }

      // ===============================
      // FOLDER SOURCE MODE
      // ===============================

      const respawned = await ensureSufficientStackSize(source, destDir);
      if (respawned) return;

      const result = await compareFolders(
        source,
        destDir,
        options.shouldCopy,
        false,                // sync already handled manually
        options.filterPath
      );

      printResults(result);
    }
  }
}

// Main execution
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseArguments(args);

  if (!options.configPath && (!options.folderA || !options.folderB)) {
    console.log("Usage:");
    console.log("  compair <folderA> <folderB> [options]");
    console.log("  compair --config <config.json> [options]");
    process.exit(1);
  }

  if (options.configPath) {
    await processConfigMode(options.configPath, options);
    return;
  }

  const folderA = options.folderA!;
  const folderB = options.folderB!;

  const respawned = await ensureSufficientStackSize(folderA, folderB);
  if (respawned) return;

  if (options.syncMode) {
    console.log(`SYNC MODE: Folder B will be replaced with exact copy of Folder A\n`);
  }

  if (options.filterPath) {
    console.log(`FILTER MODE: Only processing path '${options.filterPath}'\n`);
  }

  console.log(`Comparing folders...\n`);

  const result = await compareFolders(
    folderA,
    folderB,
    options.shouldCopy,
    options.syncMode,
    options.filterPath
  );

  printResults(result);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
