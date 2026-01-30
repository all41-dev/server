import globals from "globals";
import tseslint from "typescript-eslint";
import stylisticJs from '@stylistic/eslint-plugin'

export default [
  {
    files: ["src/**/*.{js,mjs,cjs,ts}"]
  },
  {
    languageOptions: {
      globals: globals.node
    }
  },
  ...tseslint.configs.recommended,
  {
    plugins: {
      '@stylistic/ts': stylisticJs
    },
    rules: {
      "no-trailing-spaces": "error",
      "no-console": "error",
      "@stylistic/ts/indent": ['error', 2],
      "@typescript-eslint/no-unused-vars": ["error", {
        "args": "none"
      }],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/member-ordering": "error",
    }
  },
  {
    files: ["test/**/*.{js,mjs,cjs,ts}"]
  },
  {
    languageOptions: {
      globals: globals.node
    }
  },
  ...tseslint.configs.recommended,
  {
    plugins: {
      '@stylistic/ts': stylisticJs
    },
    rules: {
      "no-console": "error",
      "no-trailing-spaces": "error",
      "@stylistic/ts/indent": ['error', 2],
      "@typescript-eslint/no-unused-vars": ['error', {
        "args": "none"
      }],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/member-ordering": "error",
      "no-unused-expressions": "off",
    }
  }
];
