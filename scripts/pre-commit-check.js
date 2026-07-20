#!/usr/bin/env node
/**
 * Pre-commit hook: verifica se arquivos sensíveis estão sendo commitados
 * ============================================================
 * Este script é executado automaticamente antes de cada commit.
 * Se detectar arquivos .env, senhas, tokens ou dados sensíveis,
 * o commit é bloqueado com uma mensagem clara.
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

const PASS_EMOJI = '✅';
const FAIL_EMOJI = '❌';
const WARN_EMOJI = '⚠️';

// Lista de padrões a verificar nos arquivos staged
const SENSITIVE_PATTERNS = [
  // Chaves de API
  /sk-ant-[\w-]+/,
  /AIza[\w-]+/,
  // Tokens Google
  /GOCSPX-[\w-]+/,
  /1\/\/[\w.-]+/,
  // Tokens genéricos
  /eyJhbGciOiJ[\w-]+\.[\w-]+\.[\w-]+/,  // JWT
  /ghp_[\w]+/,  // GitHub tokens
  /xox[baprs]-[\w-]+/,  // Slack tokens
  // Senhas genéricas
  /(password|PASSWORD|senha|SENHA)\s*[:=]\s*['"][^'"]+['"]/,
  /(api_key|API_KEY|apikey)\s*[:=]\s*['"][^'"]+['"]/,
];

// Arquivos/pastas proibidos de commitar
const FORBIDDEN_PATHS = [
  /\.env$/,
  /\.env\./,
  /senhas/,
  /horivis senhas/,
  /credentials/,
  /\bsecret\b/i,
  /\btoken\b.*\.(json|txt|js|ts)$/i,
];

function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output.split('\n').filter(Boolean);
  } catch (err) {
    console.error(`${RED}${FAIL_EMOJI} Erro ao listar arquivos staged:${RESET}`, err.message);
    process.exit(1);
  }
}

function getStagedContent(file) {
  try {
    const output = execSync(`git show :"${file}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 1024 * 1024, // 1MB
    });
    return output;
  } catch {
    // Arquivo deletado ou binário
    return null;
  }
}

function checkFile(file) {
  const issues = [];

  // 1. Verificar caminho proibido
  for (const pattern of FORBIDDEN_PATHS) {
    if (pattern.test(file)) {
      issues.push(`Caminho proibido: "${file}" corresponde ao padrão "${pattern}"`);
    }
  }

  // 2. Verificar conteúdo sensível
  const content = getStagedContent(file);
  if (content) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of SENSITIVE_PATTERNS) {
        const match = line.match(pattern);
        if (match) {
          const masked = maskValue(match[0]);
          issues.push(`Conteúdo sensível em "${file}" (linha ${i + 1}): ${masked}`);
        }
      }
    }
  }

  return issues;
}

function maskValue(value) {
  if (value.length <= 8) return value;
  return value.substring(0, 4) + '****' + value.substring(value.length - 4);
}

function main() {
  console.log(`\n${BOLD}${YELLOW}═══════════════════════════════════════════`);
  console.log('  PRE-COMMIT: Verificação de Segurança');
  console.log(`═══════════════════════════════════════════${RESET}\n`);

  const stagedFiles = getStagedFiles();

  if (stagedFiles.length === 0) {
    console.log(`${WARN_EMOJI} Nenhum arquivo staged para verificar.\n`);
    process.exit(0);
  }

  console.log(`Arquivos staged: ${stagedFiles.length}\n`);

  let allIssues = [];
  let checkedCount = 0;

  for (const file of stagedFiles) {
    // Pular diretórios e arquivos binários comuns
    if (file.endsWith('/') || file.match(/\.(png|jpg|jpeg|gif|ico|svg|woff|woff2|eot|ttf)$/i)) {
      continue;
    }
    checkedCount++;
    const issues = checkFile(file);
    allIssues = allIssues.concat(issues);
  }

  if (allIssues.length > 0) {
    console.log(`${FAIL_EMOJI} ${RED}${BOLD}COMMIT BLOQUEADO - Problemas de segurança detectados:${RESET}\n`);
    
    // Agrupar por tipo
    const pathIssues = allIssues.filter(i => i.startsWith('Caminho proibido'));
    const contentIssues = allIssues.filter(i => i.startsWith('Conteúdo sensível'));

    if (pathIssues.length > 0) {
      console.log(`  ${BOLD}Arquivos proibidos:${RESET}`);
      for (const issue of pathIssues) {
        console.log(`    • ${RED}${issue}${RESET}`);
      }
      console.log('');
    }

    if (contentIssues.length > 0) {
      console.log(`  ${BOLD}Conteúdo com tokens/senhas:${RESET}`);
      for (const issue of contentIssues.slice(0, 10)) {
        console.log(`    • ${YELLOW}${issue}${RESET}`);
      }
      if (contentIssues.length > 10) {
        console.log(`    • ... e mais ${contentIssues.length - 10} ocorrências`);
      }
      console.log('');
    }

    console.log(`  ${BOLD}Para commitar mesmo assim (NÃO RECOMENDADO):${RESET}`);
    console.log(`    git commit --no-verify -m "sua mensagem"`);
    console.log('');
    console.log(`  ${BOLD}Para corrigir:${RESET}`);
    console.log(`    1. Remova os arquivos .env do stage: git reset HEAD -- <arquivo>.env`);
    console.log(`    2. Adicione ao .gitignore se necessário`);
    console.log(`    3. Tente commitar novamente\n`);

    process.exit(1);
  }

  console.log(`${PASS_EMOJI} ${GREEN}${BOLD}Verificação de segurança concluída: ${checkedCount} arquivos verificados, nenhum problema encontrado.${RESET}\n`);
  process.exit(0);
}

main();