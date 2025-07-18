import { defineConfig } from 'tsup'
import * as preset from 'tsup-preset-solid'

const preset_options: preset.PresetOptions = {
  // `entries` must be an array of entry objects.
  entries: [
    // Main library entry
    {
      // Use the `name` property to explicitly set the output folder and export name.
      name: 'index',
      entry: 'src/index.ts', // or .tsx
      // `dev_entry` applies to this specific entry object.
      dev_entry: true,
    },
    // Plugin entries
    // {
    //   name: 'ResizePlugin',
    //   entry: 'src/plugins/ResizePlugin.ts',
    // },
    // {
    //   name: 'ConnectionsPlugin',
    //   entry: 'src/plugins/ConnectionsPlugin.ts',
    // },
  ],
  drop_console: true,
}

// The rest of your file remains the same...
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
    preset.writePackageJson(package_fields)
  }
  return preset.generateTsupOptions(parsed_options)
})
