#!/usr/bin/env node

import ora from "ora";
import path from "path";
import sharp from "sharp";
import fs from "fs-extra";
import chalk from "chalk";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { performance } from "perf_hooks";
import cliProgress from "cli-progress";

// Function to get file size in MB
const getFileSizeInMB = (filePath) => {
  const stats = fs.statSync(filePath);
  return stats.size / (1024 * 1024); // Convert from bytes to MB
};

// Function to compress an image
async function compressImage(
  inputPath,
  outputPath,
  quality = 60,
  targetExt = "jpg"
) {
  try {
    const originalSize = getFileSizeInMB(inputPath);

    let sharpInstance = sharp(inputPath);

    switch (targetExt.toLowerCase()) {
      case "jpeg":
      case "jpg":
        sharpInstance = sharpInstance.jpeg({ quality, mozjpeg: true });
        break;
      case "webp":
        sharpInstance = sharpInstance.webp({ quality });
        break;
      case "png":
        sharpInstance = sharpInstance.png({ quality });
        break;
      default:
        throw new Error(`Unsupported target extension: ${targetExt}`);
    }

    await sharpInstance.toFile(outputPath);

    const compressedSize = getFileSizeInMB(outputPath);
    const savedSize = originalSize - compressedSize;
    return { originalSize, compressedSize, savedSize };
  } catch (error) {
    console.error(chalk.red(`Error compressing ${inputPath}:`), error);
    return null;
  }
}

// Main function to process the directory
async function compressImagesInDirectory(
  sourceDir,
  exportDir,
  quality,
  targetExt
) {
  try {
    const files = await fs.readdir(sourceDir);
    const imageFiles = files.filter((file) =>
      /\.(jpg|jpeg|png|webp)$/i.test(file)
    );

    if (imageFiles.length === 0) {
      console.log(
        chalk.yellow("No image files found in the specified directory.")
      );
      return;
    }

    // Ensure the export directory exists
    await fs.ensureDir(exportDir);

    const progressBar = new cliProgress.SingleBar(
      {
        format: `Compressing [{bar}] {percentage}% | ETA: {eta}s | {value}/{total} files`,
        barCompleteChar: "\u2588",
        barIncompleteChar: "\u2591",
        hideCursor: true,
      },
      cliProgress.Presets.shades_classic
    );

    const spinner = ora("Starting compression...").start();
    const startTime = performance.now();

    let totalSavedSize = 0;
    let totalOriginalSize = 0;

    progressBar.start(imageFiles.length, 0);

    for (const [index, file] of imageFiles.entries()) {
      const inputPath = path.join(sourceDir, file);
      const outputPath = path.join(
        exportDir,
        `${path.parse(file).name}.${targetExt}`
      );

      spinner.text = `Compressing ${file}...`;

      const result = await compressImage(
        inputPath,
        outputPath,
        quality,
        targetExt
      );
      if (result) {
        totalOriginalSize += result.originalSize;
        totalSavedSize += result.savedSize;

        const fileInfo = `${chalk.green(file)}: ${chalk.blue(
          result.originalSize.toFixed(2)
        )} MB -> ${chalk.blue(
          result.compressedSize.toFixed(2)
        )} MB (${chalk.yellow(`saved ${result.savedSize.toFixed(2)} MB`)})`;
        console.log(fileInfo);
      }

      progressBar.update(index + 1);
    }

    progressBar.stop();
    spinner.succeed("Compression completed!");

    const endTime = performance.now();
    const timeTaken = ((endTime - startTime) / 1000).toFixed(2); // in seconds

    // Show the overall summary
    const totalSpaceSavedPercentage = (
      (totalSavedSize / totalOriginalSize) *
      100
    ).toFixed(2);
    console.log(chalk.cyan.bold("\nSummary:"));
    console.log(`${chalk.green("Total Images:")} ${imageFiles.length}`);
    console.log(
      `${chalk.green("Total Original Size:")} ${totalOriginalSize.toFixed(
        2
      )} MB`
    );
    console.log(
      `${chalk.green("Total Saved Size:")} ${totalSavedSize.toFixed(
        2
      )} MB (${chalk.yellow(totalSpaceSavedPercentage)}% space saved)`
    );
    console.log(`${chalk.green("Time Taken:")} ${timeTaken} seconds`);
  } catch (error) {
    console.error(chalk.red("Error processing directory:"), error);
  }
}

// Define CLI arguments using yargs
const argv = yargs(hideBin(process.argv))
  .usage(
    "Usage: $0 --sourceDir <sourceDir> --exportDir <exportDir> --quality <quality> --targetExt <targetExt>"
  )
  .option("sourceDir", {
    alias: "s",
    describe: "Source directory containing images",
    demandOption: true,
    type: "string",
  })
  .option("exportDir", {
    alias: "e",
    describe: "Directory to export compressed images",
    demandOption: true,
    type: "string",
  })
  .option("quality", {
    alias: "q",
    describe: "Quality percentage for image compression (0-100)",
    default: 60,
    type: "number",
  })
  .option("ext", {
    alias: "t",
    describe:
      "Target file extension for compressed images (jpg, jpeg, webp, png)",
    default: "webp",
    type: "string",
  })
  .help("h")
  .alias("h", "help").argv;

// Run the main function
compressImagesInDirectory(
  argv.sourceDir,
  argv.exportDir,
  argv.quality,
  argv.ext
);
