#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { db } from '../lib/database/db';
import { editais, analiseIa, analiseRequisitos, analiseItensFinanciaveis, analiseDocumentos, analiseCriterios, analisePontosFracos, palavrasChave } from '../lib/database/schema';

const JSON_PATH = path.join(process.cwd(), 'data', 'editais.json');
const BACKUP_PATH = path.join(process.cwd(), 'data', 'editais.json.migration-backup');

async function migrate() {
  console.log('🚀 Iniciando migração JSON → SQLite...\n');

  // 1. Ler JSON existente
  if (!fs.existsSync(JSON_PATH)) {
    console.error('❌ Arquivo editais.json nao encontrado!');
    process.exit(1);
  }

  const jsonData = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
  console.log(`📊 Encontrados ${jsonData.length} editais para migrar`);

  // 2. Criar backup
  fs.copyFileSync(JSON_PATH, BACKUP_PATH);
  console.log(`💾 Backup criado em: ${BACKUP_PATH}\n`);

  // 3. Migrar em lotes
  const batchSize = 50;
  let migrados = 0;
  let erros = 0;
  const errosList: string[] = [];

  for (let i = 0; i < jsonData.length; i += batchSize) {
    const batch = jsonData.slice(i, i + batchSize);

    for (const edital of batch) {
      try {
        // Determinar caminho do PDF
        let pdfPath = null;
        if (edital.pdfSalvoEm) {
          const fullPath = path.join(process.cwd(), edital.pdfSalvoEm);
          if (fs.existsSync(fullPath)) {
            pdfPath = edital.pdfSalvoEm.replace('data/', '');
          }
        }

        // Inserir edital
        await db
          .insert(editais)
          .values({
            id: edital.id,
            titulo: edital.titulo,
            orgao: edital.orgao,
            valor: edital.valor || null,
            valorMin: edital.valorMin || null,
            valorMax: edital.valorMax || null,
            dataPublicacao: edital.dataPublicacao || null,
            dataLimite: edital.dataLimite,
            dataResultado: edital.dataResultado || null,
            status: (edital.status || 'Aberto') as any,
            statusAnalise: (edital.statusAnalise || 'pendente') as any,
            modalidade: edital.modalidade || null,
            abrangencia: edital.abrangencia || null,
            tipoProponente: edital.tipoProponente ? JSON.stringify(edital.tipoProponente) : null,
            areasTematicas: edital.areasTematicas ? JSON.stringify(edital.areasTematicas) : null,
            tipoEdital: (edital.tipoEdital || null) as any,
            descricao: edital.descricao || null,
            link: edital.link,
            pdfUrl: edital.pdfUrl || null,
            pdfPath,
            conteudoCompleto: edital.conteudoCompleto || null,
            fonteConteudo: (edital.fonteConteudo || null) as any,
            arquivosAnexos: edital.arquivosAnexos ? JSON.stringify(edital.arquivosAnexos) : null,
            tecnologiaFoco: edital.tecnologiaFoco || null,
            tipoFerramenta: edital.tipoFerramenta || null,
            scoreRelevancia: edital.scoreRelevancia || null,
            scoreConfiancaIa: edital.scoreConfiancaIA || null,
            validadoPorIa: !!edital.validadoPorIA,
            motivoRejeicao: edital.motivoRejeicao || null,
            foraDoEscopo: !!edital.foraDoEscopo,
            dataValidacaoIa: edital.dataValidacaoIA || null,
            scorePontuacao: edital.scorePontuacao || null,
            nivelPontuacao: (edital.nivelPontuacao || null) as any,
            motivosPontuacao: edital.motivosPontuacao ? JSON.stringify(edital.motivosPontuacao) : null,
            modoAnaliseIa: (edital.modoAnaliseIa || null) as any,
            hashPontuacao: edital.hashPontuacao || null,
            cacheClassificacaoUsado: !!edital.cacheClassificacaoUsado,
            criadoEm: edital.criadoEm || new Date().toISOString(),
            atualizadoEm: edital.atualizadoEm || new Date().toISOString(),
          })
          .run();

        // Migrar análise IA se existir
        if (edital.analiseIA) {
          const analiseResult = await db
            .insert(analiseIa)
            .values({
              editalId: edital.id,
              resumo: edital.analiseIA.resumo || null,
              objetivo: edital.analiseIA.objetivo || null,
              elegibilidade: edital.analiseIA.elegibilidade || null,
              contatoEdital: edital.analiseIA.contatoEdital || null,
              scoreAdequacao: edital.analiseIA.scoreAdequacao || null,
            })
            .returning();

          if (analiseResult[0]) {
            const analiseId = analiseResult[0].id;

            // Migrar requisitos
            if (edital.analiseIA.requisitos?.length) {
              for (const [idx, req] of edital.analiseIA.requisitos.entries()) {
                await db
                  .insert(analiseRequisitos)
                  .values({
                    analiseId,
                    requisito: req,
                    ordem: idx,
                  })
                  .run();
              }
            }

            // Migrar itens financiáveis
            if (edital.analiseIA.itensFinanciáveis?.length) {
              for (const [idx, item] of edital.analiseIA.itensFinanciáveis.entries()) {
                await db
                  .insert(analiseItensFinanciaveis)
                  .values({
                    analiseId,
                    item,
                    ordem: idx,
                  })
                  .run();
              }
            }

            // Migrar documentos necessários
            if (edital.analiseIA.documentosNecessarios?.length) {
              for (const [idx, doc] of edital.analiseIA.documentosNecessarios.entries()) {
                await db
                  .insert(analiseDocumentos)
                  .values({
                    analiseId,
                    documento: doc,
                    ordem: idx,
                  })
                  .run();
              }
            }

            // Migrar critérios de avaliação
            if (edital.analiseIA.criteriosAvaliacao?.length) {
              for (const [idx, crit] of edital.analiseIA.criteriosAvaliacao.entries()) {
                await db
                  .insert(analiseCriterios)
                  .values({
                    analiseId,
                    criterio: crit,
                    ordem: idx,
                  })
                  .run();
              }
            }

            // Migrar pontos fracos
            if (edital.analiseIA.pontosFracos?.length) {
              for (const [idx, pf] of edital.analiseIA.pontosFracos.entries()) {
                await db
                  .insert(analisePontosFracos)
                  .values({
                    analiseId,
                    pontoFraco: pf,
                    ordem: idx,
                  })
                  .run();
              }
            }
          }
        }

        // Migrar palavras-chave
        if (edital.palavrasChaveEncontradas?.length) {
          for (const palavra of edital.palavrasChaveEncontradas) {
            await db
              .insert(palavrasChave)
              .values({
                editalId: edital.id,
                palavra,
                frequencia: 1,
              })
              .run();
          }
        }

        migrados++;
      } catch (error: any) {
        console.error(`❌ Erro ao migrar edital ${edital.id}:`, error.message);
        errosList.push(`${edital.id}: ${error.message}`);
        erros++;
      }
    }

    const processado = Math.min(i + batchSize, jsonData.length);
    const percentage = Math.round((processado / jsonData.length) * 100);
    console.log(`✅ Migrados ${processado} de ${jsonData.length} (${percentage}%)`);
  }

  console.log(`\n🎉 Migração concluída!`);
  console.log(`✅ Sucesso: ${migrados}`);
  console.log(`❌ Erros: ${erros}`);

  if (errosList.length > 0) {
    console.log('\n📋 Erros encontrados:');
    errosList.forEach((e) => console.log(`  - ${e}`));
  }

  console.log('\n✨ Banco de dados SQLite populado com sucesso!');
}

// Executar
migrate().catch((err) => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
