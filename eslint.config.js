import globals from "globals"
import pluginVue from "eslint-plugin-vue"

export default [
  {
    ignores: ["dist/**", "node_modules/**", "test-results/**", "coverage/**", "preview.html", "fix_*.cjs"],
  },
  ...pluginVue.configs["flat/essential"],
  {
    files: ["**/*.{js,vue}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": "off",
      "vue/multi-word-component-names": "off",
    },
  },
]
