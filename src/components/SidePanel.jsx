export default function SidePanel({ day, update }) {
  return (
    <div className="space-y-3">
      <Section title="B 区 · 计划外的事" hint="（突发/红色事项）">
        {day.unplanned.map((v, i) => (
          <NumberedInput
            key={i}
            n={i + 1}
            value={v}
            onChange={(val) =>
              update((d) => ({
                ...d,
                unplanned: d.unplanned.map((x, j) => (j === i ? val : x))
              }))
            }
          />
        ))}
      </Section>
      <Section title="C 区 · 记录">
        {day.records.map((v, i) => (
          <NumberedInput
            key={i}
            n={i + 1}
            value={v}
            onChange={(val) =>
              update((d) => ({
                ...d,
                records: d.records.map((x, j) => (j === i ? val : x))
              }))
            }
          />
        ))}
      </Section>
      <Section title="评估" hint="（今日复盘）">
        <textarea
          value={day.evaluation || ''}
          onChange={(e) => update({ evaluation: e.target.value })}
          rows={4}
          className="w-full border border-gray-200 rounded p-2 text-sm resize-y bg-white"
          placeholder="完成度、卡点、明日调整…"
        />
      </Section>
    </div>
  )
}

function Section({ title, hint, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-3 py-2 text-sm font-semibold border-b border-gray-200">
        {title}
        {hint && <span className="text-gray-500 font-normal text-xs ml-1">{hint}</span>}
      </div>
      <div className="p-2 space-y-1">{children}</div>
    </div>
  )
}

function NumberedInput({ n, value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 w-5 text-right tabular-nums">{n}.</span>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 border-b border-gray-200 focus:border-gray-500 outline-none py-1 text-sm bg-transparent"
      />
    </div>
  )
}
