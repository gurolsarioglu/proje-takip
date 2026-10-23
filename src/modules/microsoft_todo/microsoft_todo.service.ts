import crypto from 'crypto';
import { Database } from '../../database/db.js';
import { AuthContext, MicrosoftTodoItem, Task, UUID } from '../../core/types.js';

export interface CreatePersonalTodoDTO {
  title: string;
  due_date?: string;
  importance?: 'low' | 'normal' | 'high';
  body_content?: string;
  is_starred?: boolean;
}

export class MicrosoftTodoService {
  constructor(private db: Database) {}

  /**
   * Kullanıcının Microsoft To Do & Kişisel Yapılacaklar Listesi
   */
  public getUserTodoList(auth: AuthContext): MicrosoftTodoItem[] {
    return this.db.getTodoItems(auth.tenant_id, auth.user_id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  /**
   * Sisteme Atanan Görevin Microsoft To Do'ya Eşitlenmesi (Çift Yönlü)
   */
  public syncAssignedTaskToTodo(auth: AuthContext, task: Task): MicrosoftTodoItem {
    if (!task.assignee_id) {
      throw new Error('Görev atanmış bir personele sahip değil.');
    }

    const existing = this.db.getTodoItemByLinkedTaskId(auth.tenant_id, task.id);
    const nowIso = new Date().toISOString();

    if (existing) {
      const updated = this.db.updateTodoItem(auth.tenant_id, existing.id, {
        title: task.title,
        due_date: task.current_due_date,
        is_completed: task.work_status === 'COMPLETED',
        importance: task.priority === 'HIGH' ? 'high' : (task.priority === 'LOW' ? 'low' : 'normal'),
        synced_at: nowIso
      });
      return updated!;
    }

    const assignee = this.db.getUserById(auth.tenant_id, task.assignee_id);
    const todoItem: MicrosoftTodoItem = {
      id: `ms_todo_${crypto.randomUUID().slice(0, 8)}`,
      tenant_id: auth.tenant_id,
      user_id: task.assignee_id,
      entra_oid: assignee?.entra_oid,
      title: task.title,
      body_content: task.description || 'FG Group Proje Görevi',
      is_completed: task.work_status === 'COMPLETED',
      due_date: task.current_due_date,
      importance: task.priority === 'HIGH' ? 'high' : (task.priority === 'LOW' ? 'low' : 'normal'),
      is_starred: task.priority === 'HIGH',
      linked_task_id: task.id,
      source: 'FG_SYSTEM',
      synced_at: nowIso,
      created_at: nowIso
    };

    return this.db.insertTodoItem(todoItem);
  }

  /**
   * Kullanıcının Kendisi İçin Oluşturduğu Kişisel To Do (Microsoft To Do)
   */
  public createPersonalTodo(auth: AuthContext, dto: CreatePersonalTodoDTO): MicrosoftTodoItem {
    if (!dto.title || dto.title.trim() === '') {
      throw new Error('To Do başlığı boş bırakılamaz.');
    }

    const user = this.db.getUserById(auth.tenant_id, auth.user_id);
    const nowIso = new Date().toISOString();

    const todoItem: MicrosoftTodoItem = {
      id: `ms_todo_${crypto.randomUUID().slice(0, 8)}`,
      tenant_id: auth.tenant_id,
      user_id: auth.user_id,
      entra_oid: user?.entra_oid,
      title: dto.title.trim(),
      body_content: dto.body_content?.trim() || '',
      is_completed: false,
      due_date: dto.due_date,
      importance: dto.importance || 'normal',
      is_starred: !!dto.is_starred,
      source: 'OUTLOOK_TODO',
      synced_at: nowIso,
      created_at: nowIso
    };

    return this.db.insertTodoItem(todoItem);
  }

  /**
   * To Do Durumunu Güncelle (Tamamlandı / Devam Ediyor)
   */
  public updateTodoStatus(auth: AuthContext, todo_id: string, is_completed: boolean): MicrosoftTodoItem {
    const item = this.db.getTodoItemById(auth.tenant_id, todo_id);
    if (!item) throw new Error('To Do öğesi bulunamadı.');
    if (item.user_id !== auth.user_id) throw new Error('Bu görevi güncelleme yetkiniz yok.');

    const updated = this.db.updateTodoItem(auth.tenant_id, todo_id, {
      is_completed,
      synced_at: new Date().toISOString()
    });

    return updated!;
  }

  /**
   * To Do Açıklaması / Notu Ekleme (Microsoft To Do Not Alanı)
   */
  public updateTodoNote(auth: AuthContext, todo_id: string, noteText: string): MicrosoftTodoItem {
    const item = this.db.getTodoItemById(auth.tenant_id, todo_id);
    if (!item) throw new Error('To Do öğesi bulunamadı.');
    if (item.user_id !== auth.user_id) throw new Error('Bu görevi güncelleme yetkiniz yok.');

    const updated = this.db.updateTodoItem(auth.tenant_id, todo_id, {
      body_content: noteText.trim(),
      synced_at: new Date().toISOString()
    });

    return updated!;
  }

  /**
   * To Do Yıldızlama (Önemli / Starred)
   */
  public toggleTodoStarred(auth: AuthContext, todo_id: string): MicrosoftTodoItem {
    const item = this.db.getTodoItemById(auth.tenant_id, todo_id);
    if (!item) throw new Error('To Do öğesi bulunamadı.');

    const updated = this.db.updateTodoItem(auth.tenant_id, todo_id, {
      is_starred: !item.is_starred,
      synced_at: new Date().toISOString()
    });

    return updated!;
  }

  /**
   * Tüm Proje Görevlerini Kullanıcının To Do Listesiyle Eşitle
   */
  public syncAllAssignedTasks(auth: AuthContext): MicrosoftTodoItem[] {
    const tasks = this.db.getTasks(auth.tenant_id).filter(t => t.assignee_id === auth.user_id);
    for (const t of tasks) {
      this.syncAssignedTaskToTodo(auth, t);
    }
    return this.getUserTodoList(auth);
  }
}
