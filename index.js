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
async function compressImage(inputPath, outputPath, quality = 80) {
  try {
    const originalSize = getFileSizeInMB(inputPath);

    await sharp(inputPath).jpeg({ quality, mozjpeg: true }).toFile(outputPath);

    const compressedSize = getFileSizeInMB(outputPath);
    const savedSize = originalSize - compressedSize;
    return { originalSize, compressedSize, savedSize };
  } catch (error) {
    console.error(chalk.red(`Error compressing ${inputPath}:`), error);
    return null;
  }
}

// Main function to process the directory
async function compressImagesInDirectory(sourceDir, exportDir, quality) {
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
      const outputPath = path.join(exportDir, file);

      spinner.text = `Compressing ${file}...`;

      const result = await compressImage(inputPath, outputPath, quality);
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
    "Usage: $0 --sourceDir <sourceDir> --exportDir <exportDir> --quality <quality>"
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
    default: 80,
    type: "number",
  })
  .help("h")
  .alias("h", "help").argv;

// Run the main function
compressImagesInDirectory(argv.sourceDir, argv.exportDir, argv.quality);
