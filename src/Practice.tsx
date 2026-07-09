import { useState } from "react";

function Greeting({ name, age }: { name: string; age: number }) {
  return (
    <h2>
      Hello {name}, age {age}! 👋
    </h2>
  );
}

function TaskItem({
  item,
  index,
  onToggle,
  onDelete,
}: {
  item: { text: string; done: boolean };
  index: number;
  onToggle: (index: number) => void;
  onDelete: (index: number) => void;
}) {
  return (
    <li
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "#f8f9fd",
        padding: "12px 16px",
        borderRadius: "10px",
        border: "1px solid #eef0f4",
      }}
    >
      <span
        onClick={() => onToggle(index)}
        style={{
          cursor: "pointer",
          fontSize: "14px",
          textDecoration: item.done ? "line-through" : "none",
        }}
      >
        {item.text}
      </span>
      <button
        onClick={() => onDelete(index)}
        style={{
          background: "#ffe5e5",
          border: "none",
          borderRadius: "8px",
          padding: "6px 10px",
          cursor: "pointer",
        }}
      >
        ❌
      </button>
    </li>
  );
}

function Practice() {
  const [task, setTask] = useState("");
  const [todos, setTodos] = useState<{ text: string; done: boolean }[]>([]);

  const addTask = () => {
    if (!task.trim()) return;
    setTodos([...todos, { text: task, done: false }]);

    setTask("");
  };

  const deleteTask = (index: number) => {
    const newTodos = todos.filter((_, i) => i != index);
    setTodos(newTodos);
  };

  const toggleTask = (index: number) => {
    console.log("🔄 Toggle clicked:", index); // ← YEH ADD KARO
    const newTodos = todos.map((item, i) =>
      i === index ? { ...item, done: !item.done } : item,
    );
    setTodos(newTodos);
  };

  const totalTask = todos.length;
  const completedTask = todos.filter((item) => item.done).length;
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f6f7fc",
        padding: "40px 20px",
        fontFamily: "Roboto, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "440px",
          margin: "0 auto",
          background: "#fff",
          borderRadius: "16px",
          padding: "28px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
        }}
      >
        <h1 style={{ margin: "0 0 20px", fontSize: "24px", color: "#171713" }}>
          ✅ My To-Do List
        </h1>
        <Greeting name="Hardik" age={30} />
        <Greeting name="Rahul" age={40} />
        <p style={{ color: "#8a8d98", fontSize: "13px", margin: "0 0 16px" }}>
          {totalTask} tasks total, {completedTask} completed
        </p>

        <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
          <input
            value={task}
            onChange={(e) => setTask(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addTask();
              }
            }}
            placeholder="Please add new task!"
            style={{
              flex: 1,
              padding: "12px 16px",
              border: "1px solid #ced2de",
              borderRadius: "10px",
              fontSize: "14px",
              outline: "none",
            }}
          />
          <button
            onClick={addTask}
            style={{
              padding: "12px 20px",
              background: "#2526B3",
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Add
          </button>
        </div>

        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {todos.map((item, index) => (
            <TaskItem
              key={index}
              item={item}
              index={index}
              onToggle={toggleTask}
              onDelete={deleteTask}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

export default Practice;
