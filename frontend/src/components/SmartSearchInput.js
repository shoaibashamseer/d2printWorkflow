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
    const inputRef = useRef(null);

    useEffect(() => {

        const selected = items.find(i => String(i.id) === String(value));

        if (selected)
            setText(selected[displayField] || "");

    }, [value, items, displayField]);

    useEffect(() => {

        function close(e) {

            if (!wrapperRef.current?.contains(e.target))
                setOpen(false);

        }

        document.addEventListener("mousedown", close);

        return () =>
            document.removeEventListener("mousedown", close);

    }, []);

    const filtered = useMemo(() => {

        if (!text.trim())
            return items;

        return items.filter(item =>
            String(item[displayField] || "")
                .toLowerCase()
                .includes(text.toLowerCase())
        );

    }, [items, text, displayField]);

    const exactExists = filtered.some(item =>
        String(item[displayField]).toLowerCase() ===
        text.trim().toLowerCase()
    );

    const chooseItem = (item) => {

        setText(item[displayField]);
        setOpen(false);
        setHighlight(-1);

        if (onSelect)
            onSelect(item);

    };

    const createItem = () => {

        if (!text.trim())
            return;

        setOpen(false);
        setHighlight(-1);

        if (onCreate)
            onCreate(text.trim());

    };

    const handleKeyDown = (e) => {

        if (!open)
            return;

        switch (e.key) {

            case "ArrowDown":

                e.preventDefault();

                setHighlight(h =>
                    Math.min(h + 1, filtered.length - 1)
                );

                break;

            case "ArrowUp":

                e.preventDefault();

                setHighlight(h =>
                    Math.max(h - 1, 0)
                );

                break;

            case "Enter":

                e.preventDefault();

                if (highlight >= 0 && filtered[highlight]) {

                    chooseItem(filtered[highlight]);

                }
                else {

                    if (exactExists) {

                        const item = filtered.find(i =>
                            i[displayField]
                                .toLowerCase() ===
                            text.toLowerCase()
                        );

                        if (item)
                            chooseItem(item);

                    }
                    else {

                        createItem();

                    }

                }

                break;

            case "Escape":

                setOpen(false);
                break;

            default:
                break;

        }

    };

    return (

        <div
            className="smart-search"
            ref={wrapperRef}
        >

            <input
                ref={inputRef}
                className="form-input"
                value={text}
                placeholder={placeholder}
                onFocus={() => setOpen(true)}
                onChange={e => {

                    setText(e.target.value);
                    setOpen(true);
                    setHighlight(-1);

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
                            {item[displayField]}
                        </div>

                    ))}

                    {!exactExists &&
                        text.trim() !== "" && (

                        <div
                            className="smart-create"
                            onMouseDown={createItem}
                        >
                            ➕ Create "{text}"
                        </div>

                    )}

                    {filtered.length === 0 &&
                        exactExists && (

                        <div className="smart-empty">

                            No results

                        </div>

                    )}

                </div>

            )}

        </div>

    );

}