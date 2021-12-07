import rc from 'rc';
import degit from 'degit';
import npmInstall from 'npminstall';
import npmRun from 'npm-run';
import fse from 'fs-extra-promise';
import { writeFile, readFile, copyFile, readdir, rmdir } from 'fs/promises';
import path from 'path';

const conf = rc('cash');

(async () => {
  const version = conf.version;

  if (!version) {
    throw 'No version supplied';
  }

  const cashPath = `build/${version}`;

  // If not already done, degit the cash repo at the chosen version
  try {
    await readdir(cashPath);
  } catch (e) {
    console.log('Using degit to grab cash');

    const cashMoney = degit(`fabiospampinato/cash#${version}`, {
      cache: false,
      force: true,
      verbose: true,
    });
  
    await cashMoney.clone(cashPath);
  
    console.log('Running npm install');

    await npmInstall({
      root: cashPath
    });
  }

  // Iterate through the defined builds
  for (const build in conf.builds) {
    console.log(`Build ${build}`);

    const paccoConfig = {
      "paths": {
        "tokens": {
          "bundle": "cash"
        },
        "output": {
          "javascript": {
            "unminified": "[dist]/[bundle].js",
            "minified": "[dist]/[bundle].min.js"
          }
        }
      },
      ...conf.builds[build]
    };
    const paccoConfigPath = `${cashPath}/pacco.json`;
    const paccoRefConfigPath = `${cashPath}/pacco.json.ref`;
    const distPath = `dist/${build}`;

    // Remove any exsistng dist path if needed
    try {
      await rmdir(distPath, { recursive: true, force: true });
      console.log('Removed existing build');
    } catch (e) { }

    // Backup the default cash pacco config if needed
    try {
      await readFile(paccoRefConfigPath);
    } catch (e) {
      await copyFile(paccoConfigPath, paccoRefConfigPath);
    }

    console.log('Writing pacco config');

    // Set the pacco config to the one defined by the build
    await writeFile(paccoConfigPath, JSON.stringify(paccoConfig, null, 2));

    const cwd = `${path.resolve(path.dirname(''))}/${cashPath}`;

    try {
      // Run build tasks: clean
      console.log('Ruin build task: clean');
      await new Promise((resolve, reject) => {
        npmRun.exec('npm run clean', { cwd }, (err, stdout, stderr) => {
          if (err) {
            reject(err);
          }

          resolve();
        })
      });

      console.log('Ruin build task: build:prod');
      // Run build tasks: build for production
      await new Promise((resolve, reject) => {
        npmRun.exec('npm run build:prod', { cwd }, (err, stdout, stderr) => {
          if (err) {
            reject(err);
          }

          if (stdout.indexOf('[Error]') !== -1) {
            console.log(stdout);
            reject('Failed');
          }
          
          resolve();
        })
      });
    } catch (e) {
      console.log('ERROR');
      console.log(e);
      process.exit(1);
    }
 
    const buildPath = `${path.resolve(path.dirname(''))}/${cashPath}/dist`;

    console.log('Copying build to dist');

    // Copy the cash build directory to our dist directory
    await fse.copy(buildPath, distPath);
  }
})();