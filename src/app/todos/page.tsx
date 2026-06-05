"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Modal, Input, Form, App } from "antd";
import { useAuth } from "@/components/auth/useAuth";

interface Todo {
  id: number;
  title: string;
  description: string;
  completed: number;
  createdAt: string;
  updatedAt: string;
}

export default function TodosPage() {
  const { message } = App.useApp();
  const { user, isLoading: authLoading, authFetch } = useAuth();
  const t = useTranslations('todosPage');
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const fetchTodos = () => {
    if (!user) return;
    authFetch("/api/todos")
      .then((res) => {
        if (!res.ok) {
          setTodos([]);
          setLoading(false);
          return;
        }
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setTodos(data);
        } else {
          setTodos([]);
        }
        setLoading(false);
        window.dispatchEvent(new Event("todos-changed"));
      })
      .catch(() => {
        setTodos([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (authLoading || !user) {
      setTodos([]);
      setLoading(false);
      return;
    }
    fetchTodos();
  }, [authLoading, user]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const title = (values.title || "").trim();
      const description = (values.description || "").trim();
      if (!title) return;
      setSaving(true);

      if (editingTodo) {
        // Edit mode
        const res = await authFetch("/api/todos", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingTodo.id, title, description }),
        });
        setSaving(false);
        if (res.ok) {
          form.resetFields();
          setEditingTodo(null);
          message.success(t('todoUpdated'));
          fetchTodos();
        } else {
          const data = await res.json();
          message.error(data.error || t('failedToUpdate'));
        }
      } else {
        // Add mode
        const res = await authFetch("/api/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description }),
        });
        setSaving(false);
        if (res.ok) {
          form.resetFields();
          setShowForm(false);
          message.success(t('todoAdded'));
          fetchTodos();
        } else {
          const data = await res.json();
          message.error(data.error || t('failedToAdd'));
        }
      }
    } catch {
      // validation failed
    }
  };

  const handleToggle = async (todo: Todo) => {
    const res = await authFetch("/api/todos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: todo.id, completed: !todo.completed }),
    });
    if (res.ok) fetchTodos();
  };

  const handleDelete = async (id: number) => {
    await authFetch("/api/todos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setConfirmDeleteId(null);
    fetchTodos();
  };

  const handleStartEdit = (todo: Todo) => {
    setEditingTodo(todo);
    form.setFieldsValue({ title: todo.title, description: todo.description });
  };

  const pendingTodos = todos.filter((t) => t.completed === 0);
  const completedTodos = todos.filter((t) => t.completed === 1);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-400 dark:text-gray-500">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{t('title')}</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {t('addTodo')}
        </button>
      </div>

      {/* Add Todo Modal */}
      <Modal
        title={t('addTodoTitle')}
        open={showForm}
        onOk={handleSave}
        okText={t('add')}
        confirmLoading={saving}
        onCancel={() => {
          setShowForm(false);
          form.resetFields();
        }}
        destroyOnHidden
        centered
        mask={{ closable: false }}
      >
        <Form
          form={form}
          layout="vertical"
          className="mt-4"
        >
          <Form.Item
            label={t('titleLabel')}
            name="title"
            rules={[
              { required: true, message: t('titleRequired') },
              { max: 100, message: t('titleMaxLength') },
            ]}
          >
            <Input placeholder={t('titlePlaceholder')} maxLength={100} autoFocus />
          </Form.Item>
          <Form.Item
            label={t('descriptionLabel')}
            name="description"
            rules={[
              { max: 100, message: t('descriptionMaxLength') },
            ]}
          >
            <Input placeholder={t('descriptionPlaceholder')} maxLength={100} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Todo Modal */}
      <Modal
        title={t('editTodoTitle')}
        open={!!editingTodo}
        onOk={handleSave}
        okText={t('save')}
        confirmLoading={saving}
        onCancel={() => {
          setEditingTodo(null);
          form.resetFields();
        }}
        destroyOnHidden
        centered
        mask={{ closable: false }}
      >
        <Form
          form={form}
          layout="vertical"
          className="mt-4"
        >
          <Form.Item
            label={t('titleLabel')}
            name="title"
            rules={[
              { required: true, message: t('titleRequired') },
              { max: 100, message: t('titleMaxLength') },
            ]}
          >
            <Input placeholder={t('titlePlaceholder')} maxLength={100} autoFocus />
          </Form.Item>
          <Form.Item
            label={t('descriptionLabel')}
            name="description"
            rules={[
              { max: 100, message: t('descriptionMaxLength') },
            ]}
          >
            <Input placeholder={t('descriptionPlaceholder')} maxLength={100} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {todos.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-gray-400 dark:text-gray-500 mb-2">{t('noTodos')}</p>
              <button
                onClick={() => setShowForm(true)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                {t('addFirstTodo')}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Pending Section */}
            <section>
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                {t('pending', { count: pendingTodos.length })}
              </h2>
              {pendingTodos.length === 0 ? (
                <p className="text-sm text-gray-300 dark:text-gray-600 py-2">{t('allCaughtUp')}</p>
              ) : (
                <div className="space-y-2">
                  {pendingTodos.map((todo) => (
                    <TodoItem
                      key={todo.id}
                      todo={todo}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                      onEdit={handleStartEdit}
                      confirmDeleteId={confirmDeleteId}
                      setConfirmDeleteId={setConfirmDeleteId}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Completed Section */}
            {completedTodos.length > 0 && (
              <section>
                <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  {t('completed', { count: completedTodos.length })}
                </h2>
                <div className="space-y-2">
                  {completedTodos.map((todo) => (
                    <TodoItem
                      key={todo.id}
                      todo={todo}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                      onEdit={handleStartEdit}
                      confirmDeleteId={confirmDeleteId}
                      setConfirmDeleteId={setConfirmDeleteId}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Todo Item Component ──

function TodoItem({
  todo,
  onToggle,
  onDelete,
  onEdit,
  confirmDeleteId,
  setConfirmDeleteId,
}: {
  todo: Todo;
  onToggle: (todo: Todo) => void;
  onDelete: (id: number) => void;
  onEdit: (todo: Todo) => void;
  confirmDeleteId: number | null;
  setConfirmDeleteId: (id: number | null) => void;
}) {
  const t = useTranslations('todosPage');
  const isCompleted = todo.completed === 1;

  return (
    <div
      className={`group flex items-start gap-3 p-3 rounded-lg border transition-colors ${
        isCompleted
          ? "bg-gray-50 dark:bg-zinc-800 border-gray-100 dark:border-zinc-700"
          : "bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 hover:border-blue-200 dark:hover:border-blue-800"
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggle(todo)}
        className="mt-0.5 flex-shrink-0"
        title={isCompleted ? t('markPending') : t('markCompleted')}
      >
        {isCompleted ? (
          <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-gray-300 dark:text-gray-600 hover:text-blue-400 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
          </svg>
        )}
      </button>

      {/* Content */}
      <button
        onClick={() => onEdit(todo)}
        className="flex-1 min-w-0 text-left"
      >
        <p className={`text-sm ${isCompleted ? "text-gray-400 dark:text-gray-500 line-through" : "text-gray-800 dark:text-gray-100 font-medium"}`}>
          {todo.title}
        </p>
        {todo.description && (
          <p className={`text-xs mt-0.5 ${isCompleted ? "text-gray-300 dark:text-gray-600" : "text-gray-500 dark:text-gray-400"}`}>
            {todo.description}
          </p>
        )}
      </button>

      {/* Actions (visible on hover) */}
      <span className="relative flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
        <button
          onClick={() => onEdit(todo)}
          className="text-gray-300 dark:text-gray-600 hover:text-blue-400 transition-colors"
          title={t('edit')}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <button
          onClick={() => setConfirmDeleteId(confirmDeleteId === todo.id ? null : todo.id)}
          className="text-gray-300 dark:text-gray-600 hover:text-red-400 transition-colors"
          title={t('delete')}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
        {confirmDeleteId === todo.id && (
          <span className="absolute right-0 top-full mt-1 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 px-3 py-2 flex items-center gap-2 text-xs whitespace-nowrap z-50">
            <span className="text-gray-500">{t('deleteConfirm')}</span>
            <button
              onClick={() => onDelete(todo.id)}
              className="px-1.5 py-0.5 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            >
              {t('delete')}
            </button>
            <button
              onClick={() => setConfirmDeleteId(null)}
              className="px-1.5 py-0.5 text-gray-500 hover:text-gray-700 transition-colors"
            >
              {t('cancel')}
            </button>
          </span>
        )}
      </span>
    </div>
  );
}
