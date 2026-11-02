
import { useEffect, useMemo, useRef, useState } from "react";

export default function SmartSearchInput({
    items = [],
    value = "",
    placeholder = "Search...",
    displayField = "name",
    onSelect,
    onCreate,
}) {
    const [text, setText] = useState("");
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(-1);

    const wrapperRef = useRef(null);

    const getDisplayName = (item) => {
        if (displayField === "name") {
            return (
                item.name?.trim() ||
                item.company_name?.trim() ||
                "Unnamed Customer"
            );
        }

        return item[displayField] || "";
    };

    useEffect(() => {
        const selected = items.find(
            item => String(item.id) === String(value)
        );

        if (selected) {
            setText(getDisplayName(selected));
        } else if (!value) {
            setText("");
        }
    }, [value, items, displayField]);

    useEffect(() => {
        function close(event) {
            if (!wrapperRef.current?.contains(event.target)) {
                setOpen(false);
                setHighlight(-1);
            }
        }

        document.addEventListener("mousedown", close);

        return () => {
            document.removeEventListener("mousedown", close);
        };
    }, []);

    const filtered = useMemo(() => {
        const search = text.trim().toLowerCase();

        if (!search) return items;

        return items.filter(item => {
            const name = String(item.name || "").toLowerCase();
            const company = String(item.company_name || "").toLowerCase();
            const phone = String(item.phone || "").toLowerCase();
            const display = String(getDisplayName(item)).toLowerCase();

            return (
                name.includes(search) ||
                company.includes(search) ||
                phone.includes(search) ||
                display.includes(search)
            );
        });
    }, [items, text, displayField]);

    const exactItem = useMemo(() => {
        const search = text.trim().toLowerCase();

        if (!search) return null;

        return items.find(item => {
            const name = String(item.name || "").trim().toLowerCase();
            const company = String(item.company_name || "").trim().toLowerCase();

            return name === search || company === search;
        });
    }, [items, text]);

    const chooseItem = (item) => {
        setText(getDisplayName(item));
        setOpen(false);
        setHighlight(-1);
        onSelect?.(item);
    };

    const createItem = () => {
        const newText = text.trim();

        if (!newText) return;

        if (exactItem) {
            chooseItem(exactItem);
            return;
        }

        setOpen(false);
        setHighlight(-1);
        onCreate?.(newText);
    };

    const handleKeyDown = (event) => {
        if (event.key === "Escape") {
            setOpen(false);
            setHighlight(-1);
            return;
        }

        if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);

            setHighlight(current =>
                Math.min(current + 1, filtered.length - 1)
            );
            return;
        }

        if (event.key === "ArrowUp") {
            event.preventDefault();

            setHighlight(current =>
                Math.max(current - 1, 0)
            );
            return;
        }

        if (event.key === "Enter" && open) {
            event.preventDefault();

            if (highlight >= 0 && filtered[highlight]) {
                chooseItem(filtered[highlight]);
            } else if (exactItem) {
                chooseItem(exactItem);
            } else {
                createItem();
            }
        }
    };

    return (
        <div className="smart-search" ref={wrapperRef}>
            <input
                className="form-input"
                value={text}
                placeholder={placeholder}
                onFocus={() => setOpen(true)}
                onChange={event => {
                    setText(event.target.value);
                    setOpen(true);
                    setHighlight(-1);
                    onSelect?.(null);
                }}
                onKeyDown={handleKeyDown}
            />

            {open && (
                <div className="smart-dropdown">
                    {filtered.map((item, index) => (
                        <div
                            key={item.id}
                            className={
                                index === highlight
                                    ? "smart-item active"
                                    : "smart-item"
                            }
                            onMouseDown={() => chooseItem(item)}
                        >
                            <strong>{getDisplayName(item)}</strong>

                            {item.name && item.company_name && (
                                <small> — {item.company_name}</small>
                            )}

                            {item.phone && (
                                <small> · {item.phone}</small>
                            )}
                        </div>
                    ))}

                    {!exactItem && text.trim() !== "" && onCreate && (
                        <div
                            className="smart-create"
                            onMouseDown={event => {
                                event.preventDefault();
                                createItem();
                            }}
                        >
                            ➕ Create "{text.trim()}"
                        </div>
                    )}

                    {filtered.length === 0 && (
                        <div className="smart-empty">
                            No results
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
