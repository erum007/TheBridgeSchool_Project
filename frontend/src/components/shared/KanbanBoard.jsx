import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd'

import Badge from './Badge.jsx'

export default function KanbanBoard({ columns, onStatusChange }) {
  return (
    <DragDropContext
      onDragEnd={(result) => {
        if (!result.destination) {
          return
        }
        const itemId = result.draggableId
        const nextStatus = result.destination.droppableId
        onStatusChange(itemId, nextStatus)
      }}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {columns.map((column) => (
          <Droppable key={column.id} droppableId={column.id}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`min-h-[400px] flex-1 rounded-xl border p-3 ${
                  snapshot.isDraggingOver
                    ? 'border-dashed border-[rgba(192,57,43,0.4)] bg-[rgba(253,242,241,0.5)]'
                    : 'border-[var(--border-default)] bg-[var(--bg-app)]'
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="font-display text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">{column.title}</h4>
                  <span className="rounded-full border border-[var(--border-default)] bg-white px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">{column.items.length}</span>
                </div>
                {column.items.map((item, index) => (
                  <Draggable key={String(item.id)} draggableId={String(item.id)} index={index}>
                    {(draggableProvided, draggableSnapshot) => (
                      <div
                        ref={draggableProvided.innerRef}
                        {...draggableProvided.draggableProps}
                        {...draggableProvided.dragHandleProps}
                        className={`mb-2 rounded-lg border border-[var(--border-default)] bg-white p-3 transition-all duration-150 hover:border-[rgba(27,43,107,0.2)] hover:shadow-sm ${draggableSnapshot.isDragging ? 'opacity-50' : ''}`}
                      >
                        <p className="mb-2 text-sm font-medium text-[var(--text-primary)]">{item.description}</p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">{item.assignedToName || item.assigneeName || 'Unassigned'}</p>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <Badge status={item.status} />
                          {item.dueDate ? <span className="text-xs text-[var(--text-muted)]">Due {item.dueDate}</span> : null}
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  )
}
