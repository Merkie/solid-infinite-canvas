import { defineConfig } from 'tsup'
import * as preset from 'tsup-preset-solid'

const preset_options: preset.PresetOptions = {
  // Add your plugins to this entries array
  entries: [
    // 1. Your default entry for the main library
    {
      entry: 'src/index.ts', // or .tsx
      dev_entry: true,
    },
    // 2. Add an entry for each plugin submodule
    {
      entry: 'src/plugins/ResizePlugin.ts', // or .tsx
    },
    {
      entry: 'src/plugins/ConnectionsPlugin.ts', // or .tsx
    },
  ],
  drop_console: true,
  // cjs: true,
}

const CI =
  process.env['CI'] === 'true' ||
  process.env['GITHUB_ACTIONS'] === 'true' ||
  process.env['CI'] === '"1"' ||
  process.env['GITHUB_ACTIONS'] === '"1"'

export default defineConfig(config => {
  const watching = !!config.watch

  const parsed_options = preset.parsePresetOptions(preset_options, watching)

  if (!watching && !CI) {
    const package_fields = preset.generatePackageExports(parsed_options)

    console.log(`package.json: \n\n${JSON.stringify(package_fields, null, 2)}\n\n`)

    // This will now write the correct exports for your plugins
    preset.writePackageJson(package_fields)
  }

  return preset.generateTsupOptions(parsed_options)
})
