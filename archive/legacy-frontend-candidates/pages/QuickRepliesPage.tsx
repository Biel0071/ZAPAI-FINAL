import { FormEvent, useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormField, TextArea, TextInput } from '../components/ui/FormField';
import { Modal } from '../components/ui/Modal';
import { api } from '../lib/api';
import { QuickReply } from '../types';
import { useAppStore } from '../store/appStore';

export default function QuickRepliesPage() {
  const [items, setItems] = useState<QuickReply[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<QuickReply | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('geral');
  const [content, setContent] = useState('');
  const setQuickReplies = useAppStore((state) => state.setQuickReplies);

  async function load() {
    const data = await api.get<QuickReply[]>('/api/quick-replies');
    setItems(data);
    setQuickReplies(data);
  }

  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    setEditing(null);
    setTitle('');
    setCategory('geral');
    setContent('');
    setOpen(true);
  }

  function openEdit(item: QuickReply) {
    setEditing(item);
    setTitle(item.title);
    setCategory(item.category);
    setContent(item.content);
    setOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload = { title, category, content, tags: [] };

    if (editing) {
      await api.put(`/api/quick-replies/${editing.id}`, payload);
    } else {
      await api.post('/api/quick-replies', payload);
    }

    setOpen(false);
    await load();
  }

  async function remove(id: string) {
    await api.delete(`/api/quick-replies/${id}`);
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Respostas Rapidas</h2>
        <Button onClick={openCreate}>Nova resposta</Button>
      </div>

      <Card>
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg border border-borderSoft bg-panelSoft px-3 py-2">
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-slate-400">{item.category} - {item.content}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => openEdit(item)}>Editar</Button>
                <Button variant="danger" onClick={() => remove(item.id)}>Excluir</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Modal open={open} title={editing ? 'Editar resposta rapida' : 'Nova resposta rapida'} onClose={() => setOpen(false)}>
        <form onSubmit={submit} className="space-y-3">
          <FormField label="Titulo">
            <TextInput value={title} onChange={(event) => setTitle(event.target.value)} />
          </FormField>
          <FormField label="Categoria">
            <TextInput value={category} onChange={(event) => setCategory(event.target.value)} />
          </FormField>
          <FormField label="Conteudo">
            <TextArea value={content} onChange={(event) => setContent(event.target.value)} />
          </FormField>
          <div className="flex justify-end">
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
