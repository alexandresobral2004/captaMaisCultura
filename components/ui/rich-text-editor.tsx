'use client';

import React, { useRef, useEffect, useState } from 'react';
import { 
  Bold, Italic, Underline, 
  List, ListOrdered, RemoveFormatting, Table,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Indent, Outdent, ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Keep editor content in sync with external value, only when it differs to avoid caret jumps
  useEffect(() => {
    if (editorRef.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || '<p><br></p>';
      }
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      onChange(html === '<p><br></p>' || html === '<br>' ? '' : html);
    }
  };

  const execCommand = (command: string, arg: string = '') => {
    document.execCommand(command, false, arg);
    handleInput();
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  const insertTable = () => {
    const tableHTML = `
      <table style="width: 100%; border-collapse: collapse; margin: 12px 0; border: 1px solid #cbd5e1;">
        <thead>
          <tr style="background-color: #f8fafc;">
            <th style="border: 1px solid #cbd5e1; padding: 10px; font-weight: 600; text-align: left; font-size: 13px;">Item</th>
            <th style="border: 1px solid #cbd5e1; padding: 10px; font-weight: 600; text-align: left; font-size: 13px;">Descrição</th>
            <th style="border: 1px solid #cbd5e1; padding: 10px; font-weight: 600; text-align: left; font-size: 13px;">Valor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 10px; font-size: 13px;">-</td>
            <td style="border: 1px solid #e2e8f0; padding: 10px; font-size: 13px;">-</td>
            <td style="border: 1px solid #e2e8f0; padding: 10px; font-size: 13px;">-</td>
          </tr>
        </tbody>
      </table>
      <p><br></p>
    `;
    execCommand('insertHTML', tableHTML);
  };

  const setFontSize = (size: string) => {
    // Standard sizes mapping: 2 = small (12px), 3 = normal (14px), 5 = large (18px)
    let commandSize = '3';
    if (size === 'pequena') commandSize = '2';
    if (size === 'grande') commandSize = '5';
    execCommand('fontSize', commandSize);
  };

  const setParagraphSpacing = (spacingValue: string) => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      let container = range.commonAncestorContainer as HTMLElement;
      if (container.nodeType === Node.TEXT_NODE) {
        container = container.parentElement as HTMLElement;
      }
      
      let blockElement: HTMLElement | null = container;
      while (
        blockElement && 
        blockElement !== editorRef.current && 
        !['P', 'H2', 'H3', 'LI', 'DIV', 'TD'].includes(blockElement.tagName)
      ) {
        blockElement = blockElement.parentElement;
      }

      if (blockElement && blockElement !== editorRef.current) {
        blockElement.style.marginBottom = spacingValue;
        handleInput();
      } else {
        document.execCommand('formatBlock', false, '<p>');
        const newSelection = window.getSelection();
        if (newSelection && newSelection.rangeCount > 0) {
          let newContainer = newSelection.getRangeAt(0).commonAncestorContainer as HTMLElement;
          if (newContainer.nodeType === Node.TEXT_NODE) {
            newContainer = newContainer.parentElement as HTMLElement;
          }
          let newBlock: HTMLElement | null = newContainer;
          while (
            newBlock && 
            newBlock !== editorRef.current && 
            !['P', 'H2', 'H3', 'LI', 'DIV', 'TD'].includes(newBlock.tagName)
          ) {
            newBlock = newBlock.parentElement;
          }
          if (newBlock && newBlock !== editorRef.current) {
            newBlock.style.marginBottom = spacingValue;
            handleInput();
          }
        }
      }
      
      if (editorRef.current) {
        editorRef.current.focus();
      }
    }
  };

  return (
    <div className={cn(
      "group w-full flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/70 backdrop-blur-md transition-all duration-300 shadow-sm",
      isFocused ? "border-violet-500 ring-2 ring-violet-500/10 shadow-md" : "hover:border-slate-300 dark:hover:border-slate-700",
      className
    )}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 dark:border-slate-800 p-2 bg-slate-50/50 dark:bg-slate-900/40 rounded-t-xl select-none">
        
        {/* Text Styles */}
        <button
          type="button"
          onClick={() => execCommand('bold')}
          className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all active:scale-95"
          title="Negrito"
        >
          <Bold className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => execCommand('italic')}
          className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all active:scale-95"
          title="Itálico"
        >
          <Italic className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => execCommand('underline')}
          className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all active:scale-95"
          title="Sublinhado"
        >
          <Underline className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* Tipo de Bloco Selector */}
        <div className="relative flex items-center">
          <select
            onChange={(e) => execCommand('formatBlock', e.target.value)}
            defaultValue="<p>"
            className="appearance-none bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs px-3 py-1.5 pr-6 rounded-lg cursor-pointer focus:outline-none transition-all active:scale-95"
            title="Tipo de Bloco"
          >
            <option value="<p>">Parágrafo</option>
            <option value="<h2>">Título 2</option>
            <option value="<h3>">Título 3</option>
          </select>
          <ChevronDown className="w-3 h-3 absolute right-2 text-slate-500 pointer-events-none" />
        </div>

        <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* Tamanho de Fonte Selector */}
        <div className="relative flex items-center">
          <select
            onChange={(e) => setFontSize(e.target.value)}
            defaultValue="media"
            className="appearance-none bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs px-3 py-1.5 pr-6 rounded-lg cursor-pointer focus:outline-none transition-all active:scale-95"
            title="Tamanho de Fonte"
          >
            <option value="pequena">Pequena</option>
            <option value="media">Média</option>
            <option value="grande">Grande</option>
          </select>
          <ChevronDown className="w-3 h-3 absolute right-2 text-slate-500 pointer-events-none" />
        </div>

        <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* Alignment */}
        <button
          type="button"
          onClick={() => execCommand('justifyLeft')}
          className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all active:scale-95"
          title="Alinhar à Esquerda"
        >
          <AlignLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => execCommand('justifyCenter')}
          className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all active:scale-95"
          title="Centralizar"
        >
          <AlignCenter className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => execCommand('justifyRight')}
          className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all active:scale-95"
          title="Alinhar à Direita"
        >
          <AlignRight className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => execCommand('justifyFull')}
          className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all active:scale-95"
          title="Justificar"
        >
          <AlignJustify className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* Espaçamento de Parágrafo Selector */}
        <div className="relative flex items-center">
          <select
            onChange={(e) => setParagraphSpacing(e.target.value)}
            defaultValue="8px"
            className="appearance-none bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs px-3 py-1.5 pr-6 rounded-lg cursor-pointer focus:outline-none transition-all active:scale-95"
            title="Espaço de Parágrafo"
          >
            <option value="4px">Espaço Curto (4px)</option>
            <option value="8px">Espaço Normal (8px)</option>
            <option value="16px">Espaço Médio (16px)</option>
            <option value="28px">Espaço Grande (28px)</option>
          </select>
          <ChevronDown className="w-3 h-3 absolute right-2 text-slate-500 pointer-events-none" />
        </div>

        <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* Indentation (Recuo) */}
        <button
          type="button"
          onClick={() => execCommand('outdent')}
          className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all active:scale-95"
          title="Diminuir Recuo"
        >
          <Outdent className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => execCommand('indent')}
          className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all active:scale-95"
          title="Aumentar Recuo"
        >
          <Indent className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* Lists */}
        <button
          type="button"
          onClick={() => execCommand('insertUnorderedList')}
          className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all active:scale-95"
          title="Lista Simples"
        >
          <List className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => execCommand('insertOrderedList')}
          className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all active:scale-95"
          title="Lista Numerada"
        >
          <ListOrdered className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* Insertion Elements */}
        <button
          type="button"
          onClick={insertTable}
          className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all active:scale-95"
          title="Inserir Tabela"
        >
          <Table className="w-4 h-4" />
        </button>

        {/* Clear Formatting */}
        <button
          type="button"
          onClick={() => execCommand('removeFormat')}
          className="p-2 ml-auto text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all active:scale-95"
          title="Limpar Formatação"
        >
          <RemoveFormatting className="w-4 h-4" />
        </button>

      </div>

      {/* Editor Content Area */}
      <div className="relative flex-1 flex flex-col">
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            handleInput();
          }}
          className="editor-content p-4 min-h-[180px] focus:outline-none prose dark:prose-invert max-w-none text-slate-800 dark:text-slate-100 text-sm leading-relaxed overflow-y-auto"
          style={{ minHeight: '180px' }}
        />
        {!value && placeholder && (
          <div className="absolute top-4 left-4 text-slate-400 pointer-events-none text-sm select-none">
            {placeholder}
          </div>
        )}
      </div>

      {/* Style Helpers for editor output inside the prose class */}
      <style jsx global>{`
        .editor-content h2 {
          font-size: 1.35rem !important;
          font-weight: 700 !important;
          margin-top: 1.25rem !important;
          margin-bottom: 0.6rem !important;
          color: inherit !important;
          border-bottom: 1px solid rgba(0,0,0,0.05);
          padding-bottom: 0.25rem;
        }
        .editor-content h3 {
          font-size: 1.15rem !important;
          font-weight: 600 !important;
          margin-top: 1rem !important;
          margin-bottom: 0.5rem !important;
          color: inherit !important;
        }
        .editor-content ul {
          list-style-type: disc !important;
          padding-left: 1.5rem !important;
          margin: 0.5rem 0 !important;
        }
        .editor-content ol {
          list-style-type: decimal !important;
          padding-left: 1.5rem !important;
          margin: 0.5rem 0 !important;
        }
        .editor-content li {
          margin: 0.2rem 0 !important;
        }
        .editor-content table {
          border-collapse: collapse !important;
          width: 100% !important;
          margin: 1rem 0 !important;
        }
        .editor-content th, .editor-content td {
          border: 1px solid #cbd5e1 !important;
          padding: 10px !important;
        }
        .editor-content p {
          margin-top: 0.5rem !important;
          margin-bottom: 0.5rem;
        }
        .editor-content font[size="2"] {
          font-size: 12px !important;
        }
        .editor-content font[size="3"] {
          font-size: 14px !important;
        }
        .editor-content font[size="5"] {
          font-size: 18px !important;
        }
        /* Recuos */
        .editor-content blockquote {
          border-left: 3px solid #cbd5e1 !important;
          padding-left: 1rem !important;
          margin-left: 1rem !important;
          color: #64748b !important;
        }
      `}</style>
    </div>
  );
}
