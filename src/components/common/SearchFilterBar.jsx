import { IconSearch } from "./icons";

export default function SearchFilterBar({
  searchValue,
  onSearchChange,
  placeholder = "Search evidence ID, user, IP, keyword…",
  filters = [],
}) {
  return (
    <div className="filter-bar">
      <div className="search-input-wrap">
        <IconSearch />
        <input
          className="search-input"
          type="text"
          value={searchValue}
          placeholder={placeholder}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {filters.map((f) => (
        <select
          key={f.name}
          className="select-input"
          value={f.value}
          onChange={(e) => f.onChange(e.target.value)}
        >
          <option value="">{f.label}</option>
          {f.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ))}
    </div>
  );
}
