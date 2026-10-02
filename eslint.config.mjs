import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config({ignores:['.next/**','node_modules/**','backend/dist/**','.local/**']},js.configs.recommended,...tseslint.configs.recommended,{files:['**/*.{ts,tsx}'],rules:{'no-undef':'off','@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^_'}],'@typescript-eslint/no-namespace':['error',{allowDeclarations:true}],'@typescript-eslint/no-empty-object-type':['error',{allowInterfaces:'with-single-extends'}]}},{files:['scripts/**/*.{js,mjs,ts}'],rules:{'no-undef':'off'}});
