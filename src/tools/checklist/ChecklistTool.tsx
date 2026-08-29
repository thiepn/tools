import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Plus,
  Trash2,
  Copy,
  Check,
  Download,
  FolderPlus,
  ChevronUp,
  ChevronDown,
  Edit3,
  CopyCheck,
  Printer,
  CheckCheck,
  XSquare,
  CheckCircle2,
  Circle,
  Files,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  getStoredChecklists,
  saveChecklists,
  calculateChecklistStats,
  formatChecklistToText,
  CHECKLIST_TEMPLATES,
  ChecklistStore,
  ChecklistDoc,
  ChecklistItem,
} from '../../utilities/checklist';
import { copyToClipboard } from '../../utilities/clipboard';

export const ChecklistTool: React.FC = () => {
  const [store, setStore] = useState<ChecklistStore>(getStoredChecklists);
  const [newItemText, setNewItemText] = useState<string>('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [copied, setCopied] = useState<boolean>(false);
  const [showBulkAdd, setShowBulkAdd] = useState<boolean>(false);
  const [bulkText, setBulkText] = useState<string>('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [isPrintView, setIsPrintView] = useState<boolean>(false);

  // Persist store changes
  useEffect(() => {
    saveChecklists(store);
  }, [store]);

  const activeList =
    store.lists.find((l) => l.id === store.activeListId) || store.lists[0] || {
      id: 'default',
      title: 'My Checklist',
      updatedAt: Date.now(),
      items: [],
    };

  const stats = calculateChecklistStats(activeList.items);
  const formattedText = formatChecklistToText(activeList);

  const handleUpdateActiveList = (updates: Partial<ChecklistDoc>) => {
    setStore((prev) => ({
      ...prev,
      lists: prev.lists.map((l) =>
        l.id === activeList.id ? { ...l, ...updates, updatedAt: Date.now() } : l
      ),
    }));
  };

  const handleAddItem = (text: string) => {
    if (!text.trim()) return;
    const newItem: ChecklistItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      text: text.trim(),
      completed: false,
    };
    handleUpdateActiveList({ items: [...activeList.items, newItem] });
    setNewItemText('');
  };

  const handleToggleItem = (itemId: string) => {
    const updated = activeList.items.map((it) =>
      it.id === itemId ? { ...it, completed: !it.completed } : it
    );
    handleUpdateActiveList({ items: updated });
  };

  const handleDeleteItem = (itemId: string) => {
    const updated = activeList.items.filter((it) => it.id !== itemId);
    handleUpdateActiveList({ items: updated });
  };

  const handleMoveItem = (itemId: string, direction: 'up' | 'down') => {
    const items = [...activeList.items];
    const index = items.findIndex((i) => i.id === itemId);
    if (index < 0) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === items.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = items[index];
    items[index] = items[targetIndex];
    items[targetIndex] = temp;

    handleUpdateActiveList({ items });
  };

  const handleStartEdit = (item: ChecklistItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingItemId(item.id);
    setEditingText(item.text);
  };

  const handleSaveEdit = (itemId: string) => {
    const trimmed = editingText.trim();
    if (trimmed) {
      const updated = activeList.items.map((item) =>
        item.id === itemId ? { ...item, text: trimmed } : item
      );
      handleUpdateActiveList({ items: updated });
    }
    setEditingItemId(null);
  };

  const handleCheckAll = () => {
    const updated = activeList.items.map((it) => ({ ...it, completed: true }));
    handleUpdateActiveList({ items: updated });
  };

  const handleUncheckAll = () => {
    const updated = activeList.items.map((it) => ({ ...it, completed: false }));
    handleUpdateActiveList({ items: updated });
  };

  const handleClearCompleted = () => {
    const updated = activeList.items.filter((it) => !it.completed);
    handleUpdateActiveList({ items: updated });
  };

  const handleBulkAdd = () => {
    if (!bulkText.trim()) return;
    const lines = bulkText
      .split('\n')
      .map((l) => l.replace(/^[-\*•\[\]\sxX]+\s*/, '').trim())
      .filter(Boolean);

    const newItems: ChecklistItem[] = lines.map((text, idx) => ({
      id: `item-${Date.now()}-${idx}`,
      text,
      completed: false,
    }));

    handleUpdateActiveList({ items: [...activeList.items, ...newItems] });
    setBulkText('');
    setShowBulkAdd(false);
  };

  const handleLoadTemplate = (templateId: string) => {
    const t = CHECKLIST_TEMPLATES.find((tpl) => tpl.id === templateId);
    if (!t) return;
    const newList: ChecklistDoc = {
      id: `list-${Date.now()}`,
      title: t.name,
      updatedAt: Date.now(),
      items: t.items.map((text, idx) => ({
        id: `tpl-${Date.now()}-${idx}`,
        text,
        completed: false,
      })),
    };

    setStore((prev) => ({
      ...prev,
      activeListId: newList.id,
      lists: [newList, ...prev.lists],
    }));
  };

  const handleCreateNewList = () => {
    const newList: ChecklistDoc = {
      id: `list-${Date.now()}`,
      title: 'New Checklist',
      updatedAt: Date.now(),
      items: [],
    };
    setStore((prev) => ({
      ...prev,
      activeListId: newList.id,
      lists: [newList, ...prev.lists],
    }));
  };

  const handleDuplicateList = () => {
    const duplicated: ChecklistDoc = {
      id: `list-${Date.now()}`,
      title: `${activeList.title} (Copy)`,
      updatedAt: Date.now(),
      items: activeList.items.map((it, idx) => ({
        ...it,
        id: `dup-${Date.now()}-${idx}`,
      })),
    };
    setStore((prev) => ({
      ...prev,
      activeListId: duplicated.id,
      lists: [duplicated, ...prev.lists],
    }));
  };

  const handleDeleteList = (listId: string) => {
    if (store.lists.length <= 1) return;
    const remaining = store.lists.filter((l) => l.id !== listId);
    setStore({
      version: 1,
      activeListId: remaining[0].id,
      lists: remaining,
    });
  };

  const handleCopy = async () => {
    const ok = await copyToClipboard(formattedText);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([formattedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeList.title.toLowerCase().replace(/\s+/g, '-')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleTriggerPrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const displayedItems = activeList.items.filter((item) => {
    if (filter === 'active') return !item.completed;
    if (filter === 'completed') return item.completed;
    return true;
  });

  return (
    <ToolShell
      toolId="checklist"
      title="Checklist & Packing List"
      description="Create, customize, and track packing lists and todo checklists offline with pre-built travel, moving, and project templates."
      category="productivity"
      relatedToolIds={['notepad', 'random-picker', 'recipe-scaler']}
      outputToTransfer={formattedText}
    >
      <div className="space-y-6">
        {/* Top Actions Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800">
          {/* Lists Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={activeList.id}
              onChange={(e) => setStore({ ...store, activeListId: e.target.value })}
              className="px-2.5 py-1.5 text-xs font-semibold border rounded bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700"
            >
              {store.lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title} ({l.items.length})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleCreateNewList}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-neutral-800 hover:bg-neutral-100 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 inline-flex items-center gap-1"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>New List</span>
            </button>

            <button
              type="button"
              onClick={handleDuplicateList}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-neutral-800 hover:bg-neutral-100 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 inline-flex items-center gap-1"
              title="Duplicate current list"
            >
              <Files className="w-3.5 h-3.5" />
              <span>Duplicate</span>
            </button>

            {/* Template Dropdown */}
            <select
              onChange={(e) => {
                if (e.target.value) handleLoadTemplate(e.target.value);
                e.target.value = '';
              }}
              defaultValue=""
              className="px-2.5 py-1.5 text-xs font-medium border rounded bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300"
            >
              <option value="" disabled>
                + Load Template...
              </option>
              {CHECKLIST_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            {store.lists.length > 1 && (
              <button
                type="button"
                onClick={() => handleDeleteList(activeList.id)}
                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded"
                title="Delete this list"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTriggerPrint}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-neutral-800 hover:bg-neutral-100 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 inline-flex items-center gap-1"
              title="Print checklist"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-neutral-800 hover:bg-neutral-100 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 inline-flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied List!' : 'Copy List'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .TXT</span>
            </button>
          </div>
        </div>

        {/* Progress Bar & Header */}
        <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <input
              type="text"
              value={activeList.title}
              onChange={(e) => handleUpdateActiveList({ title: e.target.value })}
              className="text-base font-bold bg-transparent border-b border-transparent hover:border-neutral-300 focus:border-blue-500 focus:outline-none text-neutral-900 dark:text-neutral-100 px-1"
            />

            <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-neutral-600 dark:text-neutral-400">
              <span>
                {stats.completed} of {stats.total} completed ({stats.percent}%)
              </span>
              <button
                type="button"
                onClick={handleCheckAll}
                className="text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Check All
              </button>
              <button
                type="button"
                onClick={handleUncheckAll}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                Uncheck All
              </button>
              {stats.completed > 0 && (
                <button
                  type="button"
                  onClick={handleClearCompleted}
                  className="text-amber-600 dark:text-amber-400 hover:underline"
                >
                  Clear Completed
                </button>
              )}
            </div>
          </div>

          <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
              style={{ width: `${stats.percent}%` }}
            />
          </div>
        </div>

        {/* Add Item & Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAddItem(newItemText);
            }}
            className="flex-1 flex items-center gap-2 max-w-md"
          >
            <input
              type="text"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              placeholder="Add new checklist item..."
              className="flex-1 px-3 py-1.5 text-xs sm:text-sm border rounded-lg bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-2xs inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
            <button
              type="button"
              onClick={() => setShowBulkAdd(!showBulkAdd)}
              className="px-2.5 py-1.5 text-xs rounded-lg border bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100"
            >
              Bulk
            </button>
          </form>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 text-xs">
            {(['all', 'active', 'completed'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded-md capitalize font-medium ${
                  filter === f
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Bulk Add Text Area */}
        {showBulkAdd && (
          <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg space-y-2">
            <span className="text-xs font-semibold text-blue-900 dark:text-blue-200">
              Bulk Add Multiple Items (One per line)
            </span>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="Toothbrush&#10;Charger&#10;Passports&#10;Sunscreen"
              rows={4}
              className="w-full p-2 text-xs font-mono border rounded bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBulkAdd(false)}
                className="px-2.5 py-1 text-xs rounded border bg-white dark:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkAdd}
                className="px-3 py-1 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-700 text-white"
              >
                Add All Lines
              </button>
            </div>
          </div>
        )}

        {/* Checklist Items List */}
        <div className="space-y-1.5">
          {displayedItems.length === 0 ? (
            <div className="p-8 text-center border rounded-xl text-neutral-400 text-xs bg-neutral-50 dark:bg-neutral-900/40">
              No items matching this filter.
            </div>
          ) : (
            displayedItems.map((item, index) => (
              <div
                key={item.id}
                onClick={() => handleToggleItem(item.id)}
                className={`p-3 rounded-lg border flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                  item.completed
                    ? 'bg-neutral-50 dark:bg-neutral-950/60 border-neutral-200 dark:border-neutral-800 text-neutral-400 dark:text-neutral-500'
                    : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 hover:border-blue-300 shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {item.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-neutral-300 dark:text-neutral-700 shrink-0" />
                  )}
                  {editingItemId === item.id ? (
                    <input
                      type="text"
                      value={editingText}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setEditingText(e.target.value)}
                      onBlur={() => handleSaveEdit(item.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(item.id);
                        if (e.key === 'Escape') setEditingItemId(null);
                      }}
                      className="px-2 py-0.5 text-xs sm:text-sm border rounded bg-white dark:bg-neutral-950 border-blue-500 flex-1 min-w-0 font-medium"
                    />
                  ) : (
                    <span
                      onDoubleClick={(e) => handleStartEdit(item, e)}
                      className={`text-xs sm:text-sm truncate flex-1 ${
                        item.completed ? 'line-through' : 'font-medium'
                      }`}
                    >
                      {item.text}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {/* Move Up / Down */}
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => handleMoveItem(item.id, 'up')}
                    className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 disabled:opacity-20 rounded"
                    title="Move up"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    disabled={index === displayedItems.length - 1}
                    onClick={() => handleMoveItem(item.id, 'down')}
                    className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 disabled:opacity-20 rounded"
                    title="Move down"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>

                  {/* Edit */}
                  <button
                    type="button"
                    onClick={(e) => handleStartEdit(item, e)}
                    className="p-1 text-neutral-400 hover:text-blue-500 rounded"
                    title="Edit item text"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-1 text-neutral-400 hover:text-red-500 rounded"
                    title="Delete item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </ToolShell>
  );
};

export default ChecklistTool;
