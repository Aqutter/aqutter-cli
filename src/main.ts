import { ConfigError, loadProject } from './config.ts'
import pkg from '../package.json'

const HELP = `aqutter ${pkg.version}

用法：aqutter <指令> [參數]

指令：
  init                 在既有網頁專案加入 Aqutter（產生 aqutter.config.json 與 Flutter App 目錄）
  dev [target]         同跑網頁 dev server 與 flutter run（target: macos|windows|linux|ios|ios-device|android|<device id>）
  seed                 產生靜態網頁並打包種子網頁包（同時交付 web_<env>_<版本>.zip）
  build <platform>     打包 App（apk|aab|ios|ipa|macos|windows|linux），含種子、簽章、交付
  bundle keygen|sign   網頁包簽章：產生簽署金鑰；對 seed 產出的 web_<env>_<版本>.zip 簽章（設了公鑰的 App 才會接受更新）
  env add|list|remove管理設定檔裡的命名環境（env 檔、flavor、簽章、網頁指令覆蓋）
  flavor add [<name>]  為 Android / iOS / macOS 新增 flavor
  android gen-jks      產生 Android 簽章用 keystore 與 key.properties
  plugin create <name> 產生 Aqutter plugin 專案
  plugin add <pkg>     把 plugin 加入目前專案
  doctor [--offline|--refresh]  檢查專案與框架 release manifest 的版本是否一致（Flutter、殼 ref、.fvmrc、npm 依賴、lock）
  upgrade [--to=<版本>] [--dry-run] [--allow-downgrade]  把專案對齊到 manifest 的框架版本（pubspec / .fvmrc / package.json，並更新 lock）；目標比現況舊時預設拒絕

通用旗標（dev / seed / build）：-e <環境名或 env 檔>（等同 --env=…）--x-env=<名稱> --flavor=<名稱>；詳見各指令說明。

release manifest（init / plugin create / doctor / upgrade 會讀）：--offline 不連網，只用本機快取與內建快照；--refresh 略過 24 小時快取、強制連網（與 --offline 互斥）；
環境變數 AQUTTER_MANIFEST_URL 或 aqutter.config.json 的 manifest.url 可改成別的 https 網址。
`

const main = async (): Promise<void> => {
  const [command, ...rest] = process.argv.slice(2)
  if (command === undefined || command === '-h' || command === '--help' || command === 'help') {
    console.log(HELP)
    return
  }
  if (command === '-v' || command === '--version') {
    console.log(pkg.version)
    return
  }
  if (command === 'init') {
    const { runInit } = await import('./commands/init.ts')
    await runInit(process.cwd(), rest)
    return
  }
  if (command === 'bundle') {
    const { runBundle } = await import('./commands/bundle.ts')
    runBundle(process.cwd(), rest)
    return
  }
  if (command === 'plugin') {
    const { runPlugin } = await import('./commands/plugin.ts')
    await runPlugin(process.cwd(), rest)
    return
  }

  const project = loadProject(process.cwd())
  switch (command) {
    case 'dev': {
      const { runDev } = await import('./commands/dev.ts')
      await runDev(project, rest)
      return
    }
    case 'seed': {
      const { runSeed } = await import('./commands/seed.ts')
      await runSeed(project, rest)
      return
    }
    case 'build': {
      const { runBuild } = await import('./commands/build.ts')
      await runBuild(project, rest)
      return
    }
    case 'doctor': {
      const { runDoctor } = await import('./commands/doctor.ts')
      await runDoctor(project, rest)
      return
    }
    case 'upgrade': {
      const { runUpgrade } = await import('./commands/upgrade.ts')
      await runUpgrade(project, rest)
      return
    }
    case 'env': {
      const { runEnv } = await import('./commands/env.ts')
      await runEnv(project, rest)
      return
    }
    case 'flavor': {
      if (rest[0] !== 'add') {
        throw new ConfigError('用法：aqutter flavor add [<name>]')
      }
      const { runFlavorAdd } = await import('./commands/flavorAdd.ts')
      await runFlavorAdd(project, rest.slice(1))
      return
    }
    case 'android': {
      if (rest[0] !== 'gen-jks') {
        throw new ConfigError('用法：aqutter android gen-jks')
      }
      const { runGenJks } = await import('./commands/genJks.ts')
      await runGenJks(project, rest.slice(1))
      return
    }
    default:
      throw new ConfigError(`未知指令「${command}」。執行 \`aqutter help\` 查看用法。`)
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
