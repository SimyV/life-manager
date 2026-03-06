const li = "https://r2.bashai.io",
    ci = "f60350db4573f75632476ab1e039a67515a6c5240fc8c6dd4d9319fe80bef146",
    zs = "https://outlook-bridge.bashai.io",
    di = "my-secret-key-123",
    ui = "3458764661111748896",
    Vs = "https://duluxgroup.atlassian.net/browse",
    $s = ["#38bdf8", "#22c55e", "#f59e0b", "#a78bfa", "#f43f5e", "#14b8a6", "#fb923c", "#e879f9"];
async function hi() {
    try {
        const e = await Y("/config/projects.json");
        return e.ok ? e.json() : []
    } catch {
        return []
    }
}
async function pi(e) {
    await Y("/config/projects.json", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(e)
    })
}
async function mi() {
    try {
        const e = await Y("/config/contacts.json");
        return e.ok ? (await e.json()).sort((n, o) => n.name.localeCompare(o.name)) : []
    } catch {
        return []
    }
}
async function cs(e) {
    const t = [...e].sort((n, o) => n.name.localeCompare(o.name));
    await Y("/config/contacts.json", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(t)
    })
}

function gs(e) {
    return `project-${e.toLowerCase().replace(/[^a-z0-9]/g,"-")}`
}
async function Y(e, t = {}) {
    return fetch(`${li}${e}`, {
        ...t,
        credentials: "omit",
        headers: {
            Authorization: `Bearer ${ci}`,
            ...t.headers || {}
        }
    })
}
async function xs(e) {
    const t = await e.arrayBuffer(),
        o = ii(new Uint8Array(t))["word/document.xml"];
    if (!o) throw new Error("Not a valid DOCX file (word/document.xml not found)");
    const s = new TextDecoder("utf-8").decode(o),
        a = [],
        i = s.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
    for (const c of i) {
        const u = (c.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).map(p => p.replace(/<[^>]*>/g, "")).join("");
        u.trim() && a.push(u.trim())
    }
    return a.join(`
`).slice(0, 2e4)
}
async function fi(e, t) {
    const n = await Y("/parse", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            text: e,
            fileName: t
        })
    });
    if (!n.ok) {
        const o = await n.json().catch(() => ({}));
        throw new Error((o == null ? void 0 : o.error) || `Parse failed: HTTP ${n.status}`)
    }
    return n.json()
}
async function jt(e, t) {
    const n = await Y(`/${t}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(e)
    });
    if (!n.ok) throw new Error(`Failed to save JSON to R2: HTTP ${n.status}`)
}
async function gi(e, t) {
    const n = await e.arrayBuffer(),
        o = await Y(`/${t}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            },
            body: n
        });
    if (!o.ok) throw new Error(`Failed to save DOCX to R2: HTTP ${o.status}`)
}
const xi = ["B&D", "DGL International", "Dulux Paint & Coating", "DuluxGroup Corporate", "Lincoln Sentry", "Selleys", "Yates"],
    Gs = [{
        label: "P1 — Critical",
        jiraPriority: "Critical",
        prioritisation: "P1",
        tshirt: "S = ($20-60k 1-3 months)",
        urgency: "Critical"
    }, {
        label: "P2 — High",
        jiraPriority: "High",
        prioritisation: "P2",
        tshirt: "S = ($20-60k 1-3 months)",
        urgency: "High"
    }, {
        label: "P3 — Medium",
        jiraPriority: "Medium",
        prioritisation: "P3",
        tshirt: "Xs = <1Month",
        urgency: "Medium"
    }, {
        label: "P4 — Low",
        jiraPriority: "Low",
        prioritisation: "P4",
        tshirt: "Xs = <1Month",
        urgency: "Low"
    }];

function me(e) {
    return {
        type: "doc",
        version: 1,
        content: [{
            type: "paragraph",
            content: [{
                type: "text",
                text: e
            }]
        }]
    }
}
async function yi(e, t, n, o, s, a, i) {
    const c = new Date().toISOString().slice(0, 10),
        d = await Y("/jira/rest/api/3/issue", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                fields: {
                    project: {
                        key: "PKPI2"
                    },
                    summary: e.description,
                    issuetype: {
                        name: "Task"
                    },
                    assignee: {
                        accountId: "5f7a805b25fbdf00685e6cf8"
                    },
                    ...i ? {
                        description: me(i)
                    } : {},
                    priority: {
                        name: s.jiraPriority
                    },
                    customfield_11588: [{
                        value: "AI"
                    }],
                    customfield_11767: [{
                        value: o
                    }],
                    customfield_11741: {
                        value: s.prioritisation
                    },
                    customfield_11578: {
                        value: "Green"
                    },
                    customfield_11581: {
                        value: s.tshirt
                    },
                    customfield_12407: {
                        value: s.urgency
                    },
                    customfield_11685: [{
                        value: "No"
                    }],
                    customfield_11813: [{
                        value: "N/A"
                    }],
                    customfield_11579: [{
                        value: "BA Competency"
                    }],
                    customfield_11576: "Simon Lobascher",
                    customfield_11580: "Simon Lobascher",
                    customfield_11683: me(`Action raised from meeting: ${t}. Owner: ${e.owner}.`),
                    customfield_11684: me(e.description),
                    customfield_11651: me("Completes an action item identified in a meeting, driving forward project delivery."),
                    customfield_11649: me(`Action completed by ${e.owner}${e.dueDate?` by ${e.dueDate}`:""}.`),
                    customfield_11582: me(`Source meeting: ${t} (${n}). Uploaded via Meeting Intelligence tab.`),
                    customfield_11589: c,
                    customfield_11342: c,
                    customfield_11398: e.dueDate || c,
                    ...e.dueDate ? {
                        duedate: e.dueDate
                    } : {
                        duedate: c
                    },
                    ...a ? {
                        labels: [gs(a)]
                    } : {}
                }
            })
        });
    if (!d.ok) {
        const p = await d.json().catch(() => ({}));
        throw new Error((p == null ? void 0 : p.message) || `Jira create failed: HTTP ${d.status}`)
    }
    const {
        key: u
    } = await d.json();
    return await Y(`/jira/rest/api/3/issue/${u}/transitions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            transition: {
                id: "111"
            }
        })
    }), u
}
async function bi(e, t, n, o, s, a) {
    const i = new Date().toISOString().slice(0, 10),
        c = e.description.split(/\s+/),
        d = c.length > 8 ? c.slice(0, 8).join(" ") : e.description,
        u = await Y("/jira/rest/api/3/issue", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                fields: {
                    project: {
                        key: "PKPI2"
                    },
                    summary: d,
                    issuetype: {
                        name: "Task"
                    },
                    assignee: {
                        accountId: "5f7a805b25fbdf00685e6cf8"
                    },
                    ...a ? {
                        description: me(a)
                    } : {},
                    priority: {
                        name: "High"
                    },
                    customfield_11588: [{
                        value: "AI"
                    }],
                    customfield_11767: [{
                        value: o
                    }],
                    customfield_11741: {
                        value: "P2"
                    },
                    customfield_11578: {
                        value: "Green"
                    },
                    customfield_11581: {
                        value: "Xs = <1Month"
                    },
                    customfield_12407: {
                        value: "Medium"
                    },
                    customfield_11685: [{
                        value: "No"
                    }],
                    customfield_11813: [{
                        value: "N/A"
                    }],
                    customfield_11579: [{
                        value: "BA Competency"
                    }],
                    customfield_11576: "Simon Lobascher",
                    customfield_11580: e.owner || "Simon Lobascher",
                    customfield_11683: me(`Decision made in meeting: ${t} on ${n}. Owner: ${e.owner||"Simon Lobascher"}.`),
                    customfield_11684: me(e.description),
                    customfield_11651: me("Tracks a decision made in a meeting, ensuring accountability and follow-through."),
                    customfield_11649: me(`Decision by ${e.owner||"Simon Lobascher"} confirmed and actioned. Made on ${n}.`),
                    customfield_11582: me(`Source meeting: ${t} (${n}). Decision uploaded via Meeting Intelligence tab.`),
                    customfield_11589: i,
                    customfield_11342: i,
                    customfield_11398: i,
                    duedate: i,
                    labels: ["decision", ...s ? [gs(s)] : []]
                }
            })
        });
    if (!u.ok) {
        const h = await u.json().catch(() => ({}));
        throw new Error((h == null ? void 0 : h.message) || `Jira create failed: HTTP ${u.status}`)
    }
    const {
        key: p
    } = await u.json();
    return await Y(`/jira/rest/api/3/issue/${p}/transitions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            transition: {
                id: "111"
            }
        })
    }), p
}

function Ur({
    projects: e,
    value: t,
    onChange: n,
    onProjectsChange: o,
    disabled: s
}) {
    const [a, i] = g.useState(!1), [c, d] = g.useState(""), [u, p] = g.useState(!1), h = async () => {
        const m = c.trim();
        if (!m) return;
        p(!0);
        const k = m.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-"),
            y = $s[e.length % $s.length],
            x = [...e, {
                id: k,
                name: m,
                colour: y
            }];
        await pi(x), o(x), n(k), d(""), i(!1), p(!1)
    };
    return r.jsxs("div", {
        className: "flex flex-col gap-1",
        children: [r.jsx("label", {
            className: "text-xs font-semibold text-slate-400",
            children: "Project"
        }), a ? r.jsxs("div", {
            className: "flex items-center gap-1.5",
            children: [r.jsx("input", {
                autoFocus: !0,
                value: c,
                onChange: m => d(m.target.value),
                onKeyDown: m => {
                    m.key === "Enter" && h(), m.key === "Escape" && (i(!1), d(""))
                },
                placeholder: "Project name...",
                className: "w-36 rounded-lg border border-cyan-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-cyan-400"
            }), r.jsx("button", {
                onClick: h,
                disabled: u || !c.trim(),
                className: "rounded-lg bg-cyan-700 px-2 py-1.5 text-xs font-semibold text-white hover:bg-cyan-600 disabled:opacity-40",
                children: u ? "…" : "Add"
            }), r.jsx("button", {
                onClick: () => {
                    i(!1), d("")
                },
                className: "rounded-lg border border-slate-600 px-2 py-1.5 text-xs text-slate-400 hover:text-slate-200",
                children: "Cancel"
            })]
        }) : r.jsxs("div", {
            className: "flex items-center gap-1.5",
            children: [r.jsxs("select", {
                value: t,
                onChange: m => n(m.target.value),
                disabled: s,
                className: "rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-cyan-500 disabled:opacity-50",
                children: [r.jsx("option", {
                    value: "",
                    children: "— None —"
                }), e.map(m => r.jsx("option", {
                    value: m.id,
                    children: m.name
                }, m.id))]
            }), r.jsx("button", {
                onClick: () => i(!0),
                className: "rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-400 hover:border-cyan-600 hover:text-cyan-300",
                title: "New project",
                children: "+ New"
            })]
        })]
    })
}

function vi({
    contacts: e,
    selected: t,
    onChange: n,
    onContactsChange: o
}) {
    const [s, a] = g.useState(""), [i, c] = g.useState(!1), [d, u] = g.useState(!1), [p, h] = g.useState(""), [m, k] = g.useState(""), [y, x] = g.useState(!1), S = g.useRef(null), w = g.useRef(null), C = e.filter(_ => {
        const T = s.toLowerCase();
        return !t.some(V => V.email === _.email) && (_.name.toLowerCase().includes(T) || _.email.toLowerCase().includes(T))
    }), D = _ => {
        var T;
        n([...t, _]), a(""), (T = S.current) == null || T.focus()
    }, M = _ => {
        n(t.filter(T => T.email !== _))
    }, A = async () => {
        const _ = p.trim(),
            T = m.trim().toLowerCase();
        if (!_ || !T) return;
        x(!0);
        const V = {
                name: _,
                email: T
            },
            B = [...e, V];
        await cs(B), o(B.sort((P, I) => P.name.localeCompare(I.name))), n([...t, V]), h(""), k(""), u(!1), x(!1)
    };
    return g.useEffect(() => {
        const _ = T => {
            w.current && !w.current.contains(T.target) && c(!1)
        };
        return document.addEventListener("mousedown", _), () => document.removeEventListener("mousedown", _)
    }, []), r.jsxs("div", {
        className: "space-y-2",
        children: [t.length > 0 && r.jsx("div", {
            className: "flex flex-wrap gap-1.5",
            children: t.map(_ => r.jsxs("span", {
                className: "flex items-center gap-1 rounded-full bg-cyan-900/50 px-2.5 py-1 text-xs font-medium text-cyan-200",
                children: [_.name, r.jsx("button", {
                    onClick: () => M(_.email),
                    className: "ml-0.5 rounded-full text-cyan-400 hover:text-white",
                    title: "Remove",
                    children: "×"
                })]
            }, _.email))
        }), r.jsxs("div", {
            ref: w,
            className: "relative",
            children: [r.jsx("input", {
                ref: S,
                type: "text",
                value: s,
                onChange: _ => {
                    a(_.target.value), c(!0)
                },
                onFocus: () => c(!0),
                placeholder: "Search contacts...",
                className: "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500"
            }), i && (s || C.length > 0) && r.jsxs("div", {
                className: "absolute z-20 mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 shadow-xl max-h-64 overflow-y-auto",
                children: [C.map(_ => r.jsxs("button", {
                    onMouseDown: T => {
                        T.preventDefault(), D(_)
                    },
                    className: "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-800",
                    children: [r.jsx("span", {
                        className: "text-slate-200",
                        children: _.name
                    }), r.jsx("span", {
                        className: "text-xs text-slate-500",
                        children: _.email
                    })]
                }, _.email)), C.length === 0 && s && !d && r.jsx("div", {
                    className: "px-3 py-2",
                    children: r.jsxs("button", {
                        onMouseDown: _ => {
                            _.preventDefault(), u(!0), h(s), c(!1)
                        },
                        className: "text-sm text-cyan-400 hover:text-cyan-300",
                        children: ['+ Add "', s, '" as new contact']
                    })
                }), C.length === 0 && !s && r.jsx("div", {
                    className: "px-3 py-2 text-xs text-slate-500",
                    children: "All contacts selected or type to search"
                })]
            })]
        }), d && r.jsxs("div", {
            className: "flex flex-wrap items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 p-2",
            children: [r.jsx("input", {
                autoFocus: !0,
                value: p,
                onChange: _ => h(_.target.value),
                placeholder: "Full name",
                className: "flex-1 min-w-32 rounded-lg border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-cyan-500"
            }), r.jsx("input", {
                value: m,
                onChange: _ => k(_.target.value),
                onKeyDown: _ => {
                    _.key === "Enter" && A()
                },
                placeholder: "email@company.com",
                type: "email",
                className: "flex-1 min-w-48 rounded-lg border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-cyan-500"
            }), r.jsx("button", {
                onClick: A,
                disabled: y || !p.trim() || !m.trim(),
                className: "rounded-lg bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-600 disabled:opacity-40",
                children: y ? "…" : "Add"
            }), r.jsx("button", {
                onClick: () => {
                    u(!1), h(""), k("")
                },
                className: "rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200",
                children: "Cancel"
            })]
        })]
    })
}

function ji({
    contacts: e,
    onContactsChange: t,
    onClose: n
}) {
    const [o, s] = g.useState(!1), [a, i] = g.useState(""), [c, d] = g.useState(""), [u, p] = g.useState(!1), [h, m] = g.useState(null), k = async () => {
        const x = a.trim(),
            S = c.trim().toLowerCase();
        if (!x || !S) return;
        p(!0);
        const w = [...e, {
            name: x,
            email: S
        }];
        await cs(w), t(w.sort((C, D) => C.name.localeCompare(D.name))), i(""), d(""), s(!1), p(!1)
    }, y = async x => {
        const S = e.filter(w => w.email !== x);
        await cs(S), t(S), m(null)
    };
    return r.jsxs("div", {
        className: "rounded-2xl border border-slate-700 bg-slate-900/90 p-5 space-y-4",
        children: [r.jsxs("div", {
            className: "flex items-center justify-between",
            children: [r.jsx("h3", {
                className: "font-semibold text-slate-200",
                children: "Manage Contacts"
            }), r.jsx("button", {
                onClick: n,
                className: "text-xs text-slate-500 hover:text-slate-300",
                children: "Close"
            })]
        }), r.jsxs("div", {
            className: "max-h-64 overflow-y-auto space-y-1",
            children: [e.map(x => r.jsxs("div", {
                className: "flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-2 text-sm",
                children: [r.jsxs("div", {
                    children: [r.jsx("span", {
                        className: "text-slate-200",
                        children: x.name
                    }), r.jsx("span", {
                        className: "ml-2 text-xs text-slate-500",
                        children: x.email
                    })]
                }), h === x.email ? r.jsxs("div", {
                    className: "flex items-center gap-2",
                    children: [r.jsx("span", {
                        className: "text-xs text-slate-400",
                        children: "Remove?"
                    }), r.jsx("button", {
                        onClick: () => y(x.email),
                        className: "rounded bg-rose-700 px-2 py-0.5 text-xs font-semibold text-white hover:bg-rose-600",
                        children: "Yes"
                    }), r.jsx("button", {
                        onClick: () => m(null),
                        className: "rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-400 hover:text-slate-200",
                        children: "No"
                    })]
                }) : r.jsx("button", {
                    onClick: () => m(x.email),
                    className: "rounded bg-rose-900/50 px-2 py-0.5 text-xs text-rose-400 hover:bg-rose-700 hover:text-white",
                    children: "Remove"
                })]
            }, x.email)), e.length === 0 && r.jsx("p", {
                className: "text-sm text-slate-500",
                children: "No contacts yet."
            })]
        }), o ? r.jsxs("div", {
            className: "flex flex-wrap items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 p-2",
            children: [r.jsx("input", {
                autoFocus: !0,
                value: a,
                onChange: x => i(x.target.value),
                placeholder: "Full name",
                className: "flex-1 min-w-32 rounded-lg border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-cyan-500"
            }), r.jsx("input", {
                value: c,
                onChange: x => d(x.target.value),
                onKeyDown: x => {
                    x.key === "Enter" && k()
                },
                placeholder: "email@company.com",
                type: "email",
                className: "flex-1 min-w-48 rounded-lg border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-cyan-500"
            }), r.jsx("button", {
                onClick: k,
                disabled: u || !a.trim() || !c.trim(),
                className: "rounded-lg bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-600 disabled:opacity-40",
                children: u ? "…" : "Add"
            }), r.jsx("button", {
                onClick: () => {
                    s(!1), i(""), d("")
                },
                className: "rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200",
                children: "Cancel"
            })]
        }) : r.jsx("button", {
            onClick: () => s(!0),
            className: "rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:border-cyan-600 hover:text-cyan-300",
            children: "+ Add Contact"
        })]
    })
}
async function ki(e) {
    const t = await Y("/email", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            meeting: e
        })
    });
    if (!t.ok) {
        const o = await t.json().catch(() => ({}));
        throw new Error((o == null ? void 0 : o.error) || `Email generation failed: HTTP ${t.status}`)
    }
    return (await t.json()).body
}

function wi({
    subject: e,
    onSubjectChange: t,
    body: n,
    onBodyChange: o,
    recipients: s,
    onSend: a,
    onDraft: i,
    bridgeAvailable: c,
    sendStatus: d
}) {
    return r.jsxs("div", {
        className: "space-y-3",
        children: [r.jsxs("div", {
            className: "rounded-lg border border-slate-700 bg-slate-950/70 p-4 space-y-2",
            children: [r.jsxs("div", {
                className: "flex items-center gap-2",
                children: [r.jsx("span", {
                    className: "text-xs text-slate-400 font-semibold shrink-0",
                    children: "Subject:"
                }), r.jsx("input", {
                    type: "text",
                    value: e,
                    onChange: u => t(u.target.value),
                    className: "flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs text-slate-200 outline-none focus:border-sky-500"
                })]
            }), r.jsxs("p", {
                className: "text-xs text-slate-400",
                children: ["To: ", r.jsx("span", {
                    className: "text-slate-300 font-normal",
                    children: s.map(u => `${u.name} <${u.email}>`).join(", ") || "—"
                })]
            }), r.jsx("hr", {
                className: "border-slate-700"
            }), r.jsx("textarea", {
                value: n,
                onChange: u => o(u.target.value),
                rows: 16,
                className: "w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-slate-300 outline-none focus:border-cyan-600 leading-relaxed resize-y",
                spellCheck: !1
            })]
        }), r.jsxs("div", {
            className: "flex items-center gap-3",
            children: [(() => {
                const u = d.state === "done" && !d.isDraft,
                    p = d.state === "sending" && !d.isDraft,
                    h = s.length === 0 || !c || p || u;
                return r.jsx("button", {
                    onClick: u ? void 0 : a,
                    disabled: h,
                    className: "rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-40",
                    title: c ? s.length === 0 ? "Add at least one recipient" : "" : "Outlook bridge not configured",
                    children: u ? "Sent" : p ? "Sending…" : "Send via Outlook"
                })
            })(), r.jsx("button", {
                onClick: i,
                disabled: !c || d.state === "sending" && !!d.isDraft,
                className: "rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40",
                title: c ? "" : "Outlook bridge not configured",
                children: d.state === "done" && d.isDraft ? "Saved" : "Save as Draft"
            }), !c && r.jsx("span", {
                className: "text-xs text-amber-400",
                children: "Outlook bridge not configured"
            })]
        })]
    })
}

function _i({
    meeting: e,
    meetingKey: t,
    onMeetingUpdate: n,
    contacts: o,
    onContactsChange: s
}) {
    const [a, i] = g.useState([]), [c, d] = g.useState({
        state: "idle",
        message: ""
    }), u = g.useRef(null), [p, h] = g.useState(!1), [m, k] = g.useState(() => `Meeting Minutes - ${e.title} (${e.date})`.replace(/[\u2013\u2014]/g, "-").replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')), [y, x] = g.useState(e.emailBody || ""), [S, w] = g.useState(!e.emailBody), [C, D] = g.useState(null), M = !!zs, A = () => {
        w(!0), D(null), ki(e).then(async T => {
            x(T);
            const V = {
                ...e,
                emailBody: T
            };
            await jt(V, t).catch(() => {}), n(V)
        }).catch(T => D(T.message)).finally(() => w(!1))
    };
    g.useEffect(() => {
        e.emailBody || A()
    }, [e.title, e.date]);
    const _ = async T => {
        if (!(a.length === 0 && !T)) {
            u.current && (clearTimeout(u.current), u.current = null), d({
                state: "sending",
                message: T ? "Saving draft…" : "Sending…",
                isDraft: T
            });
            try {
                const V = '<html><head><meta charset="utf-8"></head><body style="font-family:Aptos,Arial,sans-serif;font-size:14px;color:#000000;">' + y.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/^(Next Steps|Actions|Decisions|Key Minutes)$/gm, "<b>$1</b>").replace(/\n/g, "<br>") + "</body></html>",
                    B = await fetch(`${zs}/send`, {
                        method: "POST",
                        credentials: "omit",
                        headers: {
                            "Content-Type": "application/json",
                            "X-API-Key": di,
                            "ngrok-skip-browser-warning": "1"
                        },
                        body: JSON.stringify({
                            to: a.map(P => P.email),
                            subject: m,
                            html: V,
                            draft: T
                        })
                    });
                if (!B.ok) {
                    const P = await B.json().catch(() => ({}));
                    throw new Error((P == null ? void 0 : P.error) || `HTTP ${B.status}`)
                }
                d({
                    state: "done",
                    message: T ? "Draft saved in Outlook." : "Email sent successfully.",
                    isDraft: T
                }), T && (u.current = setTimeout(() => {
                    d({
                        state: "idle",
                        message: ""
                    }), u.current = null
                }, 2e3))
            } catch (V) {
                d({
                    state: "error",
                    message: V.message,
                    isDraft: T
                })
            }
        }
    };
    return r.jsxs("div", {
        className: "rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-4",
        children: [r.jsxs("div", {
            className: "flex items-center justify-between",
            children: [r.jsx("h3", {
                className: "font-semibold text-sky-300",
                children: "Send Meeting Minutes"
            }), r.jsx("button", {
                onClick: () => h(T => !T),
                className: "text-xs text-slate-500 hover:text-slate-300",
                title: "Manage contacts",
                children: "⚙ Contacts"
            })]
        }), p && r.jsx(ji, {
            contacts: o,
            onContactsChange: s,
            onClose: () => h(!1)
        }), r.jsxs("div", {
            children: [r.jsx("label", {
                className: "mb-1.5 block text-xs font-semibold text-slate-400",
                children: "Recipients"
            }), r.jsx(vi, {
                contacts: o,
                selected: a,
                onChange: i,
                onContactsChange: s
            })]
        }), S ? r.jsxs("div", {
            className: "flex items-center gap-2 py-4 text-sm text-slate-400",
            children: [r.jsx("span", {
                className: "inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-cyan-400"
            }), "Writing email with AI…"]
        }) : C ? r.jsxs("div", {
            className: "space-y-2",
            children: [r.jsxs("p", {
                className: "text-sm text-rose-400",
                children: ["Failed to generate email: ", C]
            }), r.jsx("button", {
                onClick: A,
                className: "text-xs text-cyan-400 hover:text-cyan-300",
                children: "Retry"
            })]
        }) : r.jsxs("div", {
            className: "space-y-2",
            children: [r.jsx("div", {
                className: "flex justify-end",
                children: r.jsx("button", {
                    onClick: A,
                    className: "text-xs text-slate-500 hover:text-cyan-300",
                    children: "↻ Regenerate"
                })
            }), r.jsx(wi, {
                subject: m,
                onSubjectChange: k,
                body: y,
                onBodyChange: x,
                recipients: a,
                onSend: () => _(!1),
                onDraft: () => _(!0),
                bridgeAvailable: M,
                sendStatus: c
            })]
        }), c.state === "error" && r.jsxs("p", {
            className: "text-sm text-rose-400",
            children: ["Error: ", c.message]
        })]
    })
}
const Ys = ["C4 L1 context diagram showing how LeanIX integrates with ServiceNow and SAP", "Process map of the order fulfilment flow with swim lanes for warehouse, dispatch and customer", "UML sequence diagram of the OAuth 2.0 auth flow between client, MuleSoft and SAP", "UML class diagram of the core domain entities: Product, Order, Customer, Inventory", "EA capability map across the five domains with colour coding by maturity"],
    kt = ["UML", "Enterprise Architecture", "Solution Architecture", "Service Design", "Code Development", "Business Analysis", "Data Architecture", "Infrastructure", "Process & Workflow", "Other"];
async function Si(e) {
    try {
        const t = await Y("/reference-docs/");
        if (!t.ok) return "";
        const o = (await t.json()).objects || [],
            s = o.filter(d => !d.key.endsWith(".parsed.json") && !d.key.endsWith(".meta.json")),
            a = new Set(o.filter(d => d.key.endsWith(".parsed.json")).map(d => d.key.replace(".parsed.json", ""))),
            i = e ? s.filter(d => e.some(u => d.key.startsWith(`reference-docs/${u}/`))) : s;
        if (i.length === 0) return "";
        const c = await Promise.all(i.map(async d => {
            if (a.has(d.key)) {
                const u = await Y(`/${d.key}.parsed.json`).catch(() => null);
                if (u != null && u.ok) try {
                    return JSON.stringify(await u.json())
                } catch {}
            }
            return Y(`/${d.key}`).then(u => u.ok ? u.text() : "").catch(() => "")
        }));
        return i.map((d, u) => c[u] ? `--- ${d.key.split("/").pop()} ---
${c[u]}` : "").filter(Boolean).join(`

`)
    } catch {
        return ""
    }
}

function Ci() {
    const [e, t] = g.useState([]), [n, o] = g.useState(!0), [s, a] = g.useState(!1), [i, c] = g.useState([]), [d, u] = g.useState(!1), [p, h] = g.useState({}), [m, k] = g.useState(null), [y, x] = g.useState(null), [S, w] = g.useState(""), [C, D] = g.useState(!1), M = g.useRef(null), A = g.useRef(null), _ = async () => {
        o(!0);
        try {
            const b = await Y("/reference-docs/"),
                N = (b.ok ? await b.json() : {
                    objects: []
                }).objects || [],
                $ = N.filter(L => !L.key.endsWith(".parsed.json") && !L.key.endsWith(".meta.json")),
                z = new Set(N.filter(L => L.key.endsWith(".parsed.json")).map(L => L.key.replace(".parsed.json", ""))),
                W = N.filter(L => L.key.endsWith(".meta.json")).map(L => L.key),
                O = {};
            await Promise.all(W.map(async L => {
                try {
                    const F = await Y(`/${L}`);
                    F.ok && (O[L.replace(".meta.json", "")] = await F.json())
                } catch {}
            }));
            const U = $.map(L => {
                var ne;
                const F = L.key.split("/"),
                    J = F[1] || "Other",
                    H = F.slice(2).join("/");
                return {
                    key: L.key,
                    fileName: H,
                    displayName: ((ne = O[L.key]) == null ? void 0 : ne.displayName) || H,
                    category: kt.includes(J) ? J : "Other",
                    size: L.size,
                    parsed: z.has(L.key),
                    uploadedAt: L.uploaded
                }
            });
            U.sort((L, F) => L.category.localeCompare(F.category) || L.displayName.localeCompare(F.displayName)), t(U)
        } catch {}
        o(!1)
    };
    g.useEffect(() => {
        _()
    }, []);
    const T = b => {
            if (!b) return;
            const E = Array.from(b).map(N => ({
                id: `${N.name}-${Date.now()}-${Math.random()}`,
                file: N,
                category: "Other"
            }));
            c(N => [...N, ...E]), a(!0)
        },
        V = async () => {
            if (i.length === 0) return;
            u(!0);
            const b = {};
            i.forEach(E => {
                b[E.id] = "pending"
            }), h({
                ...b
            });
            for (const E of i) {
                b[E.id] = "uploading", h({
                    ...b
                });
                try {
                    const N = `reference-docs/${E.category}/${E.file.name}`;
                    let $, z;
                    E.file.name.endsWith(".docx") || E.file.name.endsWith(".doc") ? ($ = await E.file.arrayBuffer(), z = "application/vnd.openxmlformats-officedocument.wordprocessingml.document") : ($ = await E.file.text(), z = "text/plain; charset=utf-8"), await Y(`/${N}`, {
                        method: "PUT",
                        headers: {
                            "Content-Type": z
                        },
                        body: $
                    }), b[E.id] = "done", h({
                        ...b
                    });
                    const W = $ instanceof ArrayBuffer ? await (async () => {
                        try {
                            return await xs(E.file)
                        } catch {
                            return ""
                        }
                    })() : $;
                    Y("/parse-artefact", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            fileName: E.file.name,
                            text: W.slice(0, 2e4),
                            meetingTitle: `Reference: ${E.category}`
                        })
                    }).then(async O => {
                        if (!O.ok) return;
                        const U = await O.json();
                        await Y(`/${N}.parsed.json`, {
                            method: "PUT",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify(U)
                        }), t(L => L.map(F => F.key === N ? {
                            ...F,
                            parsed: !0
                        } : F))
                    }).catch(() => {})
                } catch {
                    b[E.id] = "error", h({
                        ...b
                    })
                }
            }
            u(!1), a(!1), c([]), h({}), _()
        }, B = async b => {
            k(b.key);
            try {
                await Promise.all([Y(`/${b.key}`, {
                    method: "DELETE"
                }), Y(`/${b.key}.parsed.json`, {
                    method: "DELETE"
                }).catch(() => {}), Y(`/${b.key}.meta.json`, {
                    method: "DELETE"
                }).catch(() => {})]), t(E => E.filter(N => N.key !== b.key))
            } catch (E) {
                alert(`Remove failed: ${E.message}`)
            }
            k(null)
        }, P = async b => {
            if (!S.trim() || S === b.displayName) {
                x(null);
                return
            }
            D(!0);
            try {
                await Y(`/${b.key}.meta.json`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        displayName: S.trim()
                    })
                }), t(E => E.map(N => N.key === b.key ? {
                    ...N,
                    displayName: S.trim()
                } : N)), x(null)
            } catch (E) {
                alert(`Rename failed: ${E.message}`)
            }
            D(!1)
        }, I = g.useMemo(() => {
            const b = {};
            for (const E of e) b[E.category] || (b[E.category] = []), b[E.category].push(E);
            return b
        }, [e]);
    return r.jsxs("div", {
        className: "mx-auto max-w-4xl px-4 py-6 space-y-6",
        children: [r.jsxs("div", {
            className: "flex items-center justify-between",
            children: [r.jsxs("div", {
                children: [r.jsx("h2", {
                    className: "text-2xl font-bold text-white",
                    children: "Reference Documents"
                }), r.jsx("p", {
                    className: "mt-1 text-sm text-slate-400",
                    children: "Shared library used by all meetings for Miro diagram generation."
                })]
            }), r.jsxs("button", {
                onClick: () => a(!0),
                className: "flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 transition-colors",
                children: [r.jsx("svg", {
                    className: "h-4 w-4",
                    fill: "none",
                    stroke: "currentColor",
                    strokeWidth: "2",
                    viewBox: "0 0 24 24",
                    children: r.jsx("path", {
                        strokeLinecap: "round",
                        strokeLinejoin: "round",
                        d: "M12 16v-8m0 0-3 3m3-3 3 3M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1"
                    })
                }), "Upload Documents"]
            }), r.jsx("input", {
                ref: A,
                type: "file",
                multiple: !0,
                accept: ".txt,.md,.docx,.doc,.csv,.pdf,.png,.jpg,.jpeg,.zip",
                className: "hidden",
                onChange: b => T(b.target.files)
            })]
        }), n ? r.jsx("p", {
            className: "text-sm text-slate-500",
            children: "Loading…"
        }) : Object.keys(I).length === 0 ? r.jsxs("div", {
            className: "rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-12 text-center",
            children: [r.jsx("svg", {
                className: "mx-auto h-10 w-10 text-slate-700 mb-3",
                fill: "none",
                stroke: "currentColor",
                strokeWidth: "1.5",
                viewBox: "0 0 24 24",
                children: r.jsx("path", {
                    strokeLinecap: "round",
                    strokeLinejoin: "round",
                    d: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                })
            }), r.jsx("p", {
                className: "text-sm text-slate-500",
                children: "No reference documents yet."
            }), r.jsx("p", {
                className: "text-xs text-slate-600 mt-1",
                children: "Upload capability maps, architecture diagrams, process docs to ground your Miro generation in real Dulux data."
            })]
        }) : r.jsx("div", {
            className: "space-y-6",
            children: Object.entries(I).map(([b, E]) => r.jsxs("div", {
                children: [r.jsxs("h3", {
                    className: "mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500",
                    children: [b, r.jsx("span", {
                        className: "rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] font-normal normal-case tracking-normal text-slate-500",
                        children: E.length
                    })]
                }), r.jsx("div", {
                    className: "space-y-1.5",
                    children: E.map(N => r.jsx("div", {
                        className: "rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5",
                        children: y === N.key ? r.jsxs("div", {
                            className: "flex items-center gap-2",
                            children: [r.jsx("input", {
                                className: "flex-1 rounded border border-slate-500 bg-slate-700 px-2 py-1 text-xs text-slate-100 outline-none focus:border-teal-400",
                                value: S,
                                onChange: $ => w($.target.value),
                                onKeyDown: $ => {
                                    $.key === "Enter" && P(N), $.key === "Escape" && x(null)
                                },
                                autoFocus: !0
                            }), r.jsx("button", {
                                onClick: () => P(N),
                                disabled: C,
                                className: "text-xs text-teal-400 hover:text-teal-300 disabled:opacity-40",
                                children: C ? "…" : "Save"
                            }), r.jsx("button", {
                                onClick: () => x(null),
                                className: "text-xs text-slate-500 hover:text-slate-300",
                                children: "Cancel"
                            })]
                        }) : r.jsxs("div", {
                            className: "flex items-center gap-2",
                            children: [r.jsx("svg", {
                                className: "h-3.5 w-3.5 shrink-0 text-slate-500",
                                fill: "none",
                                stroke: "currentColor",
                                strokeWidth: "1.8",
                                viewBox: "0 0 24 24",
                                children: r.jsx("path", {
                                    strokeLinecap: "round",
                                    strokeLinejoin: "round",
                                    d: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                })
                            }), r.jsx("span", {
                                className: "flex-1 truncate text-sm text-slate-200",
                                children: N.displayName
                            }), N.displayName !== N.fileName && r.jsx("span", {
                                className: "shrink-0 truncate text-xs text-slate-600 max-w-[120px]",
                                title: N.fileName,
                                children: N.fileName
                            }), N.parsed ? r.jsx("span", {
                                className: "shrink-0 rounded-full bg-emerald-900/60 border border-emerald-700/60 px-1.5 py-0.5 text-[10px] text-emerald-400",
                                children: "parsed"
                            }) : r.jsx("span", {
                                className: "shrink-0 rounded-full bg-amber-900/40 border border-amber-700/40 px-1.5 py-0.5 text-[10px] text-amber-500",
                                children: "parsing…"
                            }), r.jsxs("span", {
                                className: "shrink-0 text-xs text-slate-600",
                                children: [(N.size / 1024).toFixed(1), " KB"]
                            }), r.jsx("button", {
                                onClick: () => {
                                    x(N.key), w(N.displayName)
                                },
                                className: "shrink-0 text-xs text-slate-400 hover:text-teal-300 transition-colors",
                                children: "Rename"
                            }), r.jsx("button", {
                                onClick: () => B(N),
                                disabled: m === N.key,
                                className: "shrink-0 text-xs text-rose-400 hover:text-rose-300 disabled:opacity-40",
                                children: m === N.key ? "…" : "Remove"
                            })]
                        })
                    }, N.key))
                })]
            }, b))
        }), s && r.jsx("div", {
            className: "fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4",
            children: r.jsxs("div", {
                className: "w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl",
                children: [r.jsxs("div", {
                    className: "flex items-start justify-between border-b border-slate-800 px-5 py-4",
                    children: [r.jsxs("div", {
                        children: [r.jsx("h3", {
                            className: "text-base font-semibold text-white",
                            children: "Upload Source Documents"
                        }), r.jsx("p", {
                            className: "mt-0.5 text-xs text-slate-400",
                            children: "Drop multiple files at once. Select a document type for each file before uploading."
                        })]
                    }), r.jsx("button", {
                        onClick: () => {
                            a(!1), c([]), h({})
                        },
                        className: "text-slate-500 hover:text-slate-300 text-lg leading-none",
                        children: "✕"
                    })]
                }), r.jsxs("div", {
                    ref: M,
                    className: "mx-5 mt-4 rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/50 p-6 text-center cursor-pointer hover:border-teal-600 transition-colors",
                    onClick: () => {
                        A.current && A.current.click()
                    },
                    onDragOver: b => {
                        b.preventDefault(), b.currentTarget.classList.add("border-teal-500")
                    },
                    onDragLeave: b => {
                        b.currentTarget.classList.remove("border-teal-500")
                    },
                    onDrop: b => {
                        b.preventDefault(), b.currentTarget.classList.remove("border-teal-500"), T(b.dataTransfer.files)
                    },
                    children: [r.jsx("svg", {
                        className: "mx-auto h-8 w-8 text-teal-600 mb-2",
                        fill: "none",
                        stroke: "currentColor",
                        strokeWidth: "1.8",
                        viewBox: "0 0 24 24",
                        children: r.jsx("path", {
                            strokeLinecap: "round",
                            strokeLinejoin: "round",
                            d: "M12 16v-8m0 0-3 3m3-3 3 3M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1"
                        })
                    }), r.jsx("p", {
                        className: "text-sm text-slate-300 font-medium",
                        children: "Add more files"
                    }), r.jsx("p", {
                        className: "text-xs text-slate-500",
                        children: "or click to browse"
                    }), r.jsx("p", {
                        className: "text-xs text-slate-600 mt-1",
                        children: "TXT, MD, DOCX, CSV, PDF, PNG, JPG"
                    })]
                }), r.jsxs("div", {
                    className: "px-5 py-3",
                    children: [r.jsxs("div", {
                        className: "mb-2 flex items-center justify-between",
                        children: [r.jsxs("span", {
                            className: "text-xs text-slate-400",
                            children: [i.length, " file", i.length !== 1 ? "s" : "", " selected"]
                        }), r.jsx("button", {
                            onClick: () => c([]),
                            className: "text-xs text-slate-500 hover:text-slate-300",
                            children: "Clear all"
                        })]
                    }), r.jsx("div", {
                        className: "max-h-60 overflow-y-auto space-y-2 pr-1",
                        children: i.map(b => r.jsxs("div", {
                            className: "flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2",
                            children: [r.jsx("svg", {
                                className: "h-4 w-4 shrink-0 text-slate-500",
                                fill: "none",
                                stroke: "currentColor",
                                strokeWidth: "1.8",
                                viewBox: "0 0 24 24",
                                children: r.jsx("path", {
                                    strokeLinecap: "round",
                                    strokeLinejoin: "round",
                                    d: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                })
                            }), r.jsxs("div", {
                                className: "flex-1 min-w-0",
                                children: [r.jsx("p", {
                                    className: "truncate text-xs text-slate-200",
                                    children: b.file.name
                                }), r.jsxs("p", {
                                    className: "text-[10px] text-slate-600",
                                    children: [(b.file.size / 1024).toFixed(1), " KB"]
                                })]
                            }), p[b.id] === "done" && r.jsx("span", {
                                className: "text-[10px] text-emerald-400",
                                children: "✓"
                            }), p[b.id] === "error" && r.jsx("span", {
                                className: "text-[10px] text-rose-400",
                                children: "✗"
                            }), p[b.id] === "uploading" && r.jsx("span", {
                                className: "inline-block h-3 w-3 animate-spin rounded-full border border-teal-400 border-t-transparent"
                            }), r.jsx("select", {
                                value: b.category,
                                onChange: E => c(N => N.map($ => $.id === b.id ? {
                                    ...$,
                                    category: E.target.value
                                } : $)),
                                disabled: d,
                                className: "rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-200 outline-none focus:border-teal-400 disabled:opacity-50",
                                children: kt.map(E => r.jsx("option", {
                                    value: E,
                                    children: E
                                }, E))
                            }), r.jsx("button", {
                                onClick: () => c(E => E.filter(N => N.id !== b.id)),
                                disabled: d,
                                className: "shrink-0 text-slate-500 hover:text-slate-300 disabled:opacity-40",
                                children: "✕"
                            })]
                        }, b.id))
                    })]
                }), r.jsxs("div", {
                    className: "flex items-center justify-end gap-3 border-t border-slate-800 px-5 py-4",
                    children: [r.jsx("button", {
                        onClick: () => {
                            a(!1), c([]), h({})
                        },
                        disabled: d,
                        className: "rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40",
                        children: "Cancel"
                    }), r.jsx("button", {
                        onClick: V,
                        disabled: d || i.length === 0,
                        className: "flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-40",
                        children: d ? r.jsxs(r.Fragment, {
                            children: [r.jsx("span", {
                                className: "inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-teal-200 border-t-white"
                            }), "Uploading…"]
                        }) : r.jsxs(r.Fragment, {
                            children: [r.jsx("svg", {
                                className: "h-3.5 w-3.5",
                                fill: "none",
                                stroke: "currentColor",
                                strokeWidth: "2",
                                viewBox: "0 0 24 24",
                                children: r.jsx("path", {
                                    strokeLinecap: "round",
                                    strokeLinejoin: "round",
                                    d: "M12 16v-8m0 0-3 3m3-3 3 3M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1"
                                })
                            }), "Upload ", i.length, " File", i.length !== 1 ? "s" : ""]
                        })
                    })]
                })]
            })
        })]
    })
}
const Ei = [{
    patterns: [/app(lication)?\s+arch(itecture)?/i, /apps?\s+arch/i, /application\s+map/i],
    suggest: e => "Application architecture diagram for the discussed system"
}, {
    patterns: [/integrat(e|ion|ions?)/i, /connect(or|ing|ion)?\s+(to|with|between)/i, /api\s+(connect|integrat)/i],
    suggest: (e, t) => `C4 L1 context diagram showing integrations discussed in the ${t.title} meeting`
}, {
    patterns: [/process\s+(map|flow|design|review|improvement)/i, /workflow/i, /end[\s-]to[\s-]end\s+flow/i],
    suggest: () => "Process flow map with swim lanes for the discussed process"
}, {
    patterns: [/sequence\s+diagram/i, /auth(entication)?\s+flow/i, /login\s+flow/i, /oauth/i, /api\s+call\s+flow/i],
    suggest: () => "UML sequence diagram of the authentication / API flow"
}, {
    patterns: [/class\s+diagram/i, /domain\s+model/i, /data\s+model/i, /entity/i, /erd/i],
    suggest: () => "UML class / entity diagram of core domain entities mentioned in the meeting"
}, {
    patterns: [/capability\s+map/i, /capability\s+model/i, /business\s+capabilit/i],
    suggest: () => "EA capability map covering the business capabilities discussed"
}, {
    patterns: [/c4\s+(model|diagram|l[0-9])/i, /context\s+diagram/i, /system\s+context/i],
    suggest: (e, t) => `C4 context diagram for the ${t.title} system landscape`
}, {
    patterns: [/deploy(ment)?\s+(diagram|architecture|model)/i, /infrastructure/i, /cloud\s+arch(itecture)?/i, /aws|azure|gcp/i],
    suggest: () => "Deployment / infrastructure architecture diagram for the discussed environment"
}, {
    patterns: [/swim\s*lane/i, /lane\s+diagram/i, /cross[\s-]functional/i],
    suggest: () => "Swim lane process diagram with lanes for each team / stakeholder group discussed"
}, {
    patterns: [/roadmap/i, /timeline/i, /milestone/i, /release\s+plan/i],
    suggest: () => "Roadmap / timeline diagram showing the milestones and phases discussed"
}, {
    patterns: [/mindmap/i, /mind\s+map/i, /brainstorm/i, /idea\s+map/i],
    suggest: (e, t) => `Mind map of key themes and ideas from the ${t.title} session`
}, {
    patterns: [/user\s+journey/i, /customer\s+journey/i, /experience\s+map/i],
    suggest: () => "User journey map showing touchpoints and pain points discussed"
}];

function Ni(e) {
    const t = [...e.keyPoints, ...e.decisions, ...e.actionItems.map(s => s.description), ...e.nextSteps, e.title].join(" "),
        n = [],
        o = new Set;
    for (const s of Ei) {
        if (n.length >= 5) break;
        for (const a of s.patterns) {
            const i = t.match(a);
            if (i) {
                const c = s.suggest(i[0], e);
                o.has(c) || (o.add(c), n.push(c));
                break
            }
        }
    }
    return n
}

function Ti({
    meeting: e,
    meetingKey: t
}) {
    const [n, o] = g.useState(""), [s, a] = g.useState("idle"), [i, c] = g.useState(null), [d, u] = g.useState([]), [p, h] = g.useState(!1), [m, k] = g.useState([]), [y, x] = g.useState(!1), [S, w] = g.useState(!1), [C, D] = g.useState([]), [M, A] = g.useState(!1), [_, T] = g.useState({}), [V, B] = g.useState(null), [P, I] = g.useState(""), [b, E] = g.useState(!1), [N, $] = g.useState(null), z = g.useRef(null), O = `miro-boards/${t.replace(/\.json$/,"")}/`, U = g.useMemo(() => Ni(e), [e]);
    g.useEffect(() => {
        Y(`/${O}`).then(v => v.ok ? v.json() : {
            objects: []
        }).then(async v => {
            const R = (v.objects || []).filter(re => re.key.endsWith(".json"));
            if (R.length === 0) {
                h(!0);
                return
            }
            const te = (await Promise.all(R.map(re => Y(`/${re.key}`).then(X => X.ok ? X.json() : null).catch(() => null)))).filter(Boolean);
            te.sort((re, X) => (X.generatedAt ?? "").localeCompare(re.generatedAt ?? "")), u(te), h(!0)
        }).catch(() => h(!0))
    }, [O]);
    const L = async () => {
        x(!1);
        try {
            const v = await Y("/reference-docs/"),
                R = (v.ok ? await v.json() : {
                    objects: []
                }).objects || [],
                G = R.filter(X => !X.key.endsWith(".parsed.json") && !X.key.endsWith(".meta.json")),
                te = new Set(R.filter(X => X.key.endsWith(".parsed.json")).map(X => X.key.replace(".parsed.json", ""))),
                re = G.map(X => {
                    const je = X.key.split("/"),
                        Oe = je[1] || "Other",
                        Le = je.slice(2).join("/");
                    return {
                        key: X.key,
                        fileName: Le,
                        displayName: Le,
                        category: kt.includes(Oe) ? Oe : "Other",
                        size: X.size,
                        parsed: te.has(X.key)
                    }
                });
            re.sort((X, je) => X.category.localeCompare(je.category) || X.displayName.localeCompare(je.displayName)), k(re)
        } catch {}
        x(!0)
    };
    g.useEffect(() => {
        L()
    }, []);
    const F = v => {
            if (!v) return;
            const K = Array.from(v).map(R => ({
                id: `${R.name}-${Date.now()}-${Math.random()}`,
                file: R,
                category: "Other"
            }));
            D(R => [...R, ...K]), w(!0)
        },
        J = async () => {
            if (C.length === 0) return;
            A(!0);
            const v = {};
            C.forEach(K => {
                v[K.id] = "pending"
            }), T({
                ...v
            });
            for (const K of C) {
                v[K.id] = "uploading", T({
                    ...v
                });
                try {
                    const R = `reference-docs/${K.category}/${K.file.name}`;
                    let G, te;
                    K.file.name.endsWith(".docx") || K.file.name.endsWith(".doc") ? (G = await K.file.arrayBuffer(), te = "application/vnd.openxmlformats-officedocument.wordprocessingml.document") : (G = await K.file.text(), te = "text/plain; charset=utf-8"), await Y(`/${R}`, {
                        method: "PUT",
                        headers: {
                            "Content-Type": te
                        },
                        body: G
                    }), v[K.id] = "done", T({
                        ...v
                    });
                    const re = G instanceof ArrayBuffer ? await (async () => {
                        try {
                            return await xs(K.file)
                        } catch {
                            return ""
                        }
                    })() : G;
                    Y("/parse-artefact", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            fileName: K.file.name,
                            text: re.slice(0, 2e4),
                            meetingTitle: `Reference: ${K.category}`
                        })
                    }).then(async X => {
                        if (!X.ok) return;
                        const je = await X.json();
                        await Y(`/${R}.parsed.json`, {
                            method: "PUT",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify(je)
                        }), k(Oe => Oe.map(Le => Le.key === R ? {
                            ...Le,
                            parsed: !0
                        } : Le))
                    }).catch(() => {})
                } catch {
                    v[K.id] = "error", T({
                        ...v
                    })
                }
            }
            A(!1), w(!1), D([]), T({}), L()
        }, H = async () => Si().catch(() => ""), ne = async v => {
            if (!P.trim() || P === v.title) {
                B(null);
                return
            }
            E(!0);
            try {
                const K = `${O}${v.boardId}.json`,
                    R = {
                        ...v,
                        title: P.trim()
                    };
                await Y(`/${K}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(R)
                }), u(G => G.map(te => te.boardId === v.boardId ? R : te)), B(null)
            } catch (K) {
                alert(`Rename failed: ${K.message}`)
            }
            E(!1)
        }, Q = async v => {
            $(v.boardId);
            try {
                await Y(`/${O}${v.boardId}.json`, {
                    method: "DELETE"
                }), u(K => K.filter(R => R.boardId !== v.boardId))
            } catch (K) {
                alert(`Delete failed: ${K.message}`)
            }
            $(null)
        }, ie = async () => {
            if (n.trim()) {
                a("generating"), c(null);
                try {
                    const v = await H(),
                        K = await Y("/miro", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                meeting: e,
                                prompt: n.trim(),
                                context: v || void 0,
                                teamId: ui || void 0
                            })
                        });
                    if (!K.ok) {
                        const re = await K.json().catch(() => ({}));
                        throw new Error((re == null ? void 0 : re.error) || `HTTP ${K.status}`)
                    }
                    const R = await K.json(),
                        G = {
                            ...R,
                            prompt: n.trim(),
                            generatedAt: new Date().toISOString(),
                            meetingTitle: e.title,
                            meetingDate: e.date
                        },
                        te = `${O}${R.boardId}.json`;
                    Y(`/${te}`, {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(G)
                    }).catch(() => {}), u(re => [G, ...re]), a("done")
                } catch (v) {
                    c(v.message), a("error")
                }
            }
        };
    return r.jsxs("div", {
        className: "space-y-5",
        children: [r.jsxs("div", {
            className: "rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-4",
            children: [r.jsx("h3", {
                className: "font-semibold text-purple-300",
                children: "Generate Miro Diagram"
            }), U.length > 0 && r.jsxs("div", {
                className: "space-y-1.5",
                children: [r.jsx("p", {
                    className: "text-xs font-semibold text-slate-500",
                    children: "Suggested from this meeting"
                }), r.jsx("div", {
                    className: "flex flex-wrap gap-2",
                    children: U.map((v, K) => r.jsx("button", {
                        onClick: () => o(v),
                        className: "rounded-full border border-purple-800/60 bg-purple-950/50 px-3 py-1 text-xs text-purple-300 hover:bg-purple-900/60 hover:border-purple-600 transition-colors text-left",
                        children: v
                    }, K))
                })]
            }), r.jsxs("div", {
                children: [r.jsx("label", {
                    className: "mb-1.5 block text-xs font-semibold text-slate-400",
                    children: "What do you want to create?"
                }), r.jsx("textarea", {
                    value: n,
                    onChange: v => o(v.target.value),
                    rows: 3,
                    placeholder: Ys[Math.floor(Math.random() * Ys.length)],
                    className: "w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none focus:border-purple-500 resize-none placeholder:text-slate-600"
                }), r.jsx("p", {
                    className: "mt-1 text-xs text-slate-600",
                    children: 'e.g. "C4 L1 context diagram", "process map with swim lanes", "UML class diagram of core entities"'
                })]
            }), r.jsx("button", {
                onClick: ie,
                disabled: s === "generating" || !n.trim(),
                className: "w-full rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-600 disabled:opacity-40 flex items-center justify-center gap-2",
                children: s === "generating" ? r.jsxs(r.Fragment, {
                    children: [r.jsx("span", {
                        className: "inline-block h-4 w-4 animate-spin rounded-full border-2 border-purple-300 border-t-white"
                    }), "Generating diagram…"]
                }) : "Generate in Miro"
            }), s === "error" && r.jsxs("p", {
                className: "text-sm text-rose-400",
                children: ["Error: ", i]
            })]
        }), r.jsxs("div", {
            className: "rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3",
            children: [r.jsxs("div", {
                className: "flex items-center justify-between",
                children: [r.jsxs("div", {
                    children: [r.jsx("h3", {
                        className: "font-semibold text-sky-300",
                        children: "Reference Documents"
                    }), r.jsx("p", {
                        className: "text-xs text-slate-600 mt-0.5",
                        children: "Global library — all docs auto-included in generation"
                    })]
                }), r.jsxs("button", {
                    onClick: () => w(!0),
                    className: "flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-600 transition-colors",
                    children: [r.jsx("svg", {
                        className: "h-3.5 w-3.5",
                        fill: "none",
                        stroke: "currentColor",
                        strokeWidth: "2",
                        viewBox: "0 0 24 24",
                        children: r.jsx("path", {
                            strokeLinecap: "round",
                            strokeLinejoin: "round",
                            d: "M12 16v-8m0 0-3 3m3-3 3 3M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1"
                        })
                    }), "Upload"]
                })]
            }), !y && r.jsx("p", {
                className: "text-xs text-slate-600",
                children: "Loading…"
            }), y && m.length === 0 && r.jsx("p", {
                className: "text-xs text-slate-600",
                children: "No reference documents yet. Upload docs to ground diagram generation in real Dulux data."
            }), y && m.length > 0 && r.jsx("div", {
                className: "space-y-1",
                children: m.map(v => r.jsxs("div", {
                    className: "flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5",
                    children: [r.jsx("svg", {
                        className: "h-3 w-3 shrink-0 text-slate-500",
                        fill: "none",
                        stroke: "currentColor",
                        strokeWidth: "1.8",
                        viewBox: "0 0 24 24",
                        children: r.jsx("path", {
                            strokeLinecap: "round",
                            strokeLinejoin: "round",
                            d: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        })
                    }), r.jsx("span", {
                        className: "flex-1 truncate text-xs text-slate-300",
                        children: v.displayName
                    }), r.jsx("span", {
                        className: "shrink-0 text-[10px] text-slate-600",
                        children: v.category
                    }), v.parsed ? r.jsx("span", {
                        className: "shrink-0 rounded-full bg-emerald-900/60 border border-emerald-700/60 px-1.5 py-0.5 text-[10px] text-emerald-400",
                        children: "parsed"
                    }) : r.jsx("span", {
                        className: "shrink-0 rounded-full bg-amber-900/40 border border-amber-700/40 px-1.5 py-0.5 text-[10px] text-amber-500",
                        children: "parsing…"
                    })]
                }, v.key))
            }), r.jsx("input", {
                ref: z,
                type: "file",
                multiple: !0,
                accept: ".txt,.md,.docx,.doc,.csv,.pdf,.png,.jpg,.jpeg,.zip",
                className: "hidden",
                onChange: v => F(v.target.files)
            })]
        }), S && r.jsx("div", {
            className: "fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4",
            children: r.jsxs("div", {
                className: "w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl",
                children: [r.jsxs("div", {
                    className: "flex items-start justify-between border-b border-slate-800 px-5 py-4",
                    children: [r.jsxs("div", {
                        children: [r.jsx("h3", {
                            className: "text-base font-semibold text-white",
                            children: "Upload Source Documents"
                        }), r.jsx("p", {
                            className: "mt-0.5 text-xs text-slate-400",
                            children: "Drop multiple files at once. Select a document type for each file before uploading."
                        })]
                    }), r.jsx("button", {
                        onClick: () => {
                            w(!1), D([]), T({})
                        },
                        className: "text-slate-500 hover:text-slate-300 text-lg leading-none",
                        children: "✕"
                    })]
                }), r.jsxs("div", {
                    className: "mx-5 mt-4 rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/50 p-6 text-center cursor-pointer hover:border-teal-600 transition-colors",
                    onClick: () => {
                        var v;
                        return (v = z.current) == null ? void 0 : v.click()
                    },
                    onDragOver: v => {
                        v.preventDefault(), v.currentTarget.classList.add("border-teal-500")
                    },
                    onDragLeave: v => {
                        v.currentTarget.classList.remove("border-teal-500")
                    },
                    onDrop: v => {
                        v.preventDefault(), v.currentTarget.classList.remove("border-teal-500"), F(v.dataTransfer.files)
                    },
                    children: [r.jsx("svg", {
                        className: "mx-auto h-8 w-8 text-teal-600 mb-2",
                        fill: "none",
                        stroke: "currentColor",
                        strokeWidth: "1.8",
                        viewBox: "0 0 24 24",
                        children: r.jsx("path", {
                            strokeLinecap: "round",
                            strokeLinejoin: "round",
                            d: "M12 16v-8m0 0-3 3m3-3 3 3M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1"
                        })
                    }), r.jsx("p", {
                        className: "text-sm text-slate-300 font-medium",
                        children: "Add more files"
                    }), r.jsx("p", {
                        className: "text-xs text-slate-500",
                        children: "or click to browse"
                    }), r.jsx("p", {
                        className: "text-xs text-slate-600 mt-1",
                        children: "TXT, MD, DOCX, CSV, PDF, PNG, JPG"
                    })]
                }), r.jsxs("div", {
                    className: "px-5 py-3",
                    children: [r.jsxs("div", {
                        className: "mb-2 flex items-center justify-between",
                        children: [r.jsxs("span", {
                            className: "text-xs text-slate-400",
                            children: [C.length, " file", C.length !== 1 ? "s" : "", " selected"]
                        }), r.jsx("button", {
                            onClick: () => D([]),
                            className: "text-xs text-slate-500 hover:text-slate-300",
                            children: "Clear all"
                        })]
                    }), r.jsx("div", {
                        className: "max-h-60 overflow-y-auto space-y-2 pr-1",
                        children: C.map(v => r.jsxs("div", {
                            className: "flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2",
                            children: [r.jsxs("div", {
                                className: "flex-1 min-w-0",
                                children: [r.jsx("p", {
                                    className: "truncate text-xs text-slate-200",
                                    children: v.file.name
                                }), r.jsxs("p", {
                                    className: "text-[10px] text-slate-600",
                                    children: [(v.file.size / 1024).toFixed(1), " KB"]
                                })]
                            }), _[v.id] === "done" && r.jsx("span", {
                                className: "text-[10px] text-emerald-400",
                                children: "✓"
                            }), _[v.id] === "error" && r.jsx("span", {
                                className: "text-[10px] text-rose-400",
                                children: "✗"
                            }), _[v.id] === "uploading" && r.jsx("span", {
                                className: "inline-block h-3 w-3 animate-spin rounded-full border border-teal-400 border-t-transparent"
                            }), r.jsx("select", {
                                value: v.category,
                                onChange: K => D(R => R.map(G => G.id === v.id ? {
                                    ...G,
                                    category: K.target.value
                                } : G)),
                                disabled: M,
                                className: "rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-200 outline-none focus:border-teal-400 disabled:opacity-50",
                                children: kt.map(K => r.jsx("option", {
                                    value: K,
                                    children: K
                                }, K))
                            }), r.jsx("button", {
                                onClick: () => D(K => K.filter(R => R.id !== v.id)),
                                disabled: M,
                                className: "shrink-0 text-slate-500 hover:text-slate-300 disabled:opacity-40",
                                children: "✕"
                            })]
                        }, v.id))
                    })]
                }), r.jsxs("div", {
                    className: "flex items-center justify-end gap-3 border-t border-slate-800 px-5 py-4",
                    children: [r.jsx("button", {
                        onClick: () => {
                            w(!1), D([]), T({})
                        },
                        disabled: M,
                        className: "rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40",
                        children: "Cancel"
                    }), r.jsx("button", {
                        onClick: J,
                        disabled: M || C.length === 0,
                        className: "flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-40",
                        children: M ? r.jsxs(r.Fragment, {
                            children: [r.jsx("span", {
                                className: "inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-teal-200 border-t-white"
                            }), "Uploading…"]
                        }) : r.jsxs(r.Fragment, {
                            children: [r.jsx("svg", {
                                className: "h-3.5 w-3.5",
                                fill: "none",
                                stroke: "currentColor",
                                strokeWidth: "2",
                                viewBox: "0 0 24 24",
                                children: r.jsx("path", {
                                    strokeLinecap: "round",
                                    strokeLinejoin: "round",
                                    d: "M12 16v-8m0 0-3 3m3-3 3 3M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1"
                                })
                            }), "Upload ", C.length, " File", C.length !== 1 ? "s" : ""]
                        })
                    })]
                })]
            })
        }), r.jsxs("div", {
            className: "rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3",
            children: [r.jsx("h3", {
                className: "font-semibold text-slate-300",
                children: "Board History"
            }), !p && r.jsx("p", {
                className: "text-xs text-slate-600",
                children: "Loading…"
            }), p && d.length === 0 && r.jsx("p", {
                className: "text-xs text-slate-600",
                children: "No boards generated yet for this meeting."
            }), d.map(v => r.jsx("div", {
                className: "rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 space-y-1.5",
                children: V === v.boardId ? r.jsxs("div", {
                    className: "flex items-center gap-2",
                    children: [r.jsx("input", {
                        className: "flex-1 rounded border border-slate-500 bg-slate-700 px-2 py-1 text-sm text-slate-100 outline-none focus:border-purple-400",
                        value: P,
                        onChange: K => I(K.target.value),
                        onKeyDown: K => {
                            K.key === "Enter" && ne(v), K.key === "Escape" && B(null)
                        },
                        autoFocus: !0
                    }), r.jsx("button", {
                        onClick: () => ne(v),
                        disabled: b,
                        className: "text-xs text-purple-400 hover:text-purple-300 disabled:opacity-40",
                        children: b ? "…" : "Save"
                    }), r.jsx("button", {
                        onClick: () => B(null),
                        className: "text-xs text-slate-500 hover:text-slate-300",
                        children: "Cancel"
                    })]
                }) : r.jsxs("div", {
                    className: "flex items-start justify-between gap-2",
                    children: [r.jsxs("div", {
                        className: "min-w-0 flex-1",
                        children: [r.jsx("p", {
                            className: "text-sm font-medium text-slate-200",
                            children: v.title
                        }), v.prompt && r.jsxs("p", {
                            className: "text-xs text-slate-500 truncate",
                            children: ['"', v.prompt, '"']
                        }), r.jsxs("p", {
                            className: "text-xs text-slate-600 mt-0.5",
                            children: [v.nodeCount, "/", v.aiNodeCount ?? "?", " nodes · ", v.edgeCount, "/", v.aiEdgeCount ?? "?", " connectors", v.generatedAt && ` · ${new Date(v.generatedAt).toLocaleDateString("en-AU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}`]
                        }), v.nodeErrors && v.nodeErrors.length > 0 && r.jsxs("p", {
                            className: "text-xs text-rose-400",
                            children: ["⚠ ", v.nodeErrors.length, " shape error(s)"]
                        }), v.edgeErrors && v.edgeErrors.length > 0 && r.jsxs("p", {
                            className: "text-xs text-amber-400",
                            children: ["⚠ ", v.edgeErrors.length, " connector error(s)"]
                        })]
                    }), r.jsxs("div", {
                        className: "shrink-0 flex items-center gap-2",
                        children: [r.jsx("a", {
                            href: v.viewLink,
                            target: "_blank",
                            rel: "noopener noreferrer",
                            className: "rounded-lg border border-purple-600 px-3 py-1.5 text-xs font-semibold text-purple-300 hover:bg-purple-900/40 whitespace-nowrap",
                            children: "Open ↗"
                        }), r.jsx("button", {
                            onClick: () => {
                                B(v.boardId), I(v.title)
                            },
                            className: "text-xs text-slate-400 hover:text-purple-300 transition-colors",
                            children: "Rename"
                        }), r.jsx("button", {
                            onClick: () => Q(v),
                            disabled: N === v.boardId,
                            className: "text-xs text-rose-400 hover:text-rose-300 disabled:opacity-40",
                            children: N === v.boardId ? "…" : "Delete"
                        })]
                    })]
                })
            }, v.boardId))]
        })]
    })
}

function Pi({
    meetingKey: e,
    onBack: t,
    projects: n,
    onProjectsChange: o,
    contacts: s,
    onContactsChange: a
}) {
    const [i, c] = g.useState(null), [d, u] = g.useState(!0), [p, h] = g.useState(null), [m, k] = g.useState(null), [y, x] = g.useState({
        description: "",
        owner: "",
        dueDate: "",
        isSimon: !1
    }), [S, w] = g.useState(null), [C, D] = g.useState(!1), [M, A] = g.useState(!1);
    g.useEffect(() => {
        u(!0), h(null), Y(`/${e}`).then(P => P.text()).then(P => {
            const I = JSON.parse(P);
            if (Array.isArray(I.jiraTickets)) {
                const b = {};
                I.jiraTickets.forEach((E, N) => {
                    E && I.actionItems[N] && (b[I.actionItems[N].description] = E)
                }), I.jiraTickets = b
            }
            c(I)
        }).catch(P => h(P.message)).finally(() => u(!1))
    }, [e]);
    const _ = async (P, I) => {
        if (!i) return;
        D(!0);
        const b = {
            ...i,
            actionItems: P,
            jiraTickets: I
        };
        await jt(b, e), c(b), D(!1)
    }, T = async P => {
        var $, z;
        if (!i) return;
        A(!0);
        const I = {
            ...i,
            projectId: P || void 0
        };
        await jt(I, e), c(I);
        const b = Object.values(i.jiraTickets ?? {}).filter(W => W && !W.startsWith("Error")),
            E = (($ = n.find(W => W.id === P)) == null ? void 0 : $.name) ?? null,
            N = P ? gs(P) : null;
        for (const W of b) {
            const O = await Y(`/jira/rest/api/3/issue/${W}?fields=labels`).catch(() => null);
            if (!(O != null && O.ok)) continue;
            const U = await O.json().catch(() => null),
                F = (((z = U == null ? void 0 : U.fields) == null ? void 0 : z.labels) ?? []).filter(ne => !ne.startsWith("project-")),
                H = {
                    labels: N ? [...F, N] : F
                };
            E && (H.description = me(E)), await Y(`/jira/rest/api/3/issue/${W}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    fields: H
                })
            }).catch(() => {})
        }
        A(!1)
    }, V = async P => {
        if (!i) return;
        const I = i.actionItems[P].description,
            {
                jiraKey: b,
                ...E
            } = y,
            N = {
                ...E,
                isSimon: y.owner.toLowerCase().includes("simon")
            },
            $ = i.actionItems.map((O, U) => U === P ? N : O),
            z = {
                ...i.jiraTickets
            };
        I !== y.description && z[I] && (z[y.description] = z[I], delete z[I]), b && (z[N.description] = b);
        const W = b || z[N.description];
        W && !W.startsWith("Error") && N.dueDate && await Y(`/jira/rest/api/3/issue/${W}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                fields: {
                    duedate: N.dueDate,
                    customfield_11398: N.dueDate
                }
            })
        }).catch(() => {}), await _($, z), k(null)
    }, B = async P => {
        if (!i) return;
        const I = i.actionItems[P].description,
            b = i.actionItems.filter((N, $) => $ !== P),
            E = {
                ...i.jiraTickets
            };
        delete E[I], await _(b, E), w(null)
    };
    return d ? r.jsx("div", {
        className: "py-16 text-center text-slate-400",
        children: "Loading meeting..."
    }) : p || !i ? r.jsxs("div", {
        className: "py-16 text-center text-rose-400",
        children: ["Failed to load: ", p]
    }) : r.jsxs("div", {
        className: "space-y-4",
        children: [r.jsxs("div", {
            className: "flex flex-wrap items-start justify-between gap-3",
            children: [r.jsxs("div", {
                children: [r.jsx("button", {
                    onClick: t,
                    className: "mb-2 text-xs text-slate-500 hover:text-slate-300",
                    children: "← Back to meetings"
                }), r.jsx("h2", {
                    className: "text-2xl font-bold text-slate-100",
                    children: i.title
                }), r.jsxs("p", {
                    className: "mt-1 text-sm text-slate-400",
                    children: [i.date, " · ", i.participants.length, " attendees · Uploaded ", new Date(i.uploadedAt).toLocaleDateString()]
                })]
            }), r.jsxs("div", {
                className: "flex items-end gap-2",
                children: [r.jsx(Ur, {
                    projects: n,
                    value: i.projectId ?? "",
                    onChange: T,
                    onProjectsChange: o,
                    disabled: M
                }), M && r.jsx("span", {
                    className: "mb-1.5 text-xs text-slate-500",
                    children: "Saving…"
                })]
            })]
        }), r.jsxs("div", {
            className: "rounded-xl border border-slate-800 bg-slate-900/70 p-4",
            children: [r.jsx("h3", {
                className: "mb-2 font-semibold text-cyan-300",
                children: "Attendees"
            }), r.jsx("p", {
                className: "text-sm text-slate-300",
                children: i.participants.join(", ") || "—"
            })]
        }), r.jsxs("div", {
            className: "rounded-xl border border-slate-800 bg-slate-900/70 p-4",
            children: [r.jsx("h3", {
                className: "mb-3 font-semibold text-amber-300",
                children: "Actions"
            }), i.actionItems.length === 0 ? r.jsx("p", {
                className: "text-sm text-slate-500",
                children: "No actions recorded."
            }) : r.jsx("div", {
                className: "space-y-2",
                children: i.actionItems.map((P, I) => {
                    var $;
                    const b = ($ = i.jiraTickets) == null ? void 0 : $[P.description],
                        E = m === I,
                        N = S === I;
                    return r.jsx("div", {
                        className: "rounded-lg bg-slate-950/60 px-3 py-2 text-sm",
                        children: E ? r.jsxs("div", {
                            className: "space-y-2",
                            children: [r.jsx("textarea", {
                                className: "w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500",
                                rows: 2,
                                value: y.description,
                                onChange: z => x(W => ({
                                    ...W,
                                    description: z.target.value
                                })),
                                placeholder: "Description"
                            }), r.jsxs("div", {
                                className: "flex gap-2",
                                children: [r.jsx("input", {
                                    className: "flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-cyan-500",
                                    value: y.owner,
                                    onChange: z => x(W => ({
                                        ...W,
                                        owner: z.target.value
                                    })),
                                    placeholder: "Owner"
                                }), r.jsx("input", {
                                    type: "date",
                                    className: "rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-cyan-500",
                                    value: y.dueDate ?? "",
                                    onChange: z => x(W => ({
                                        ...W,
                                        dueDate: z.target.value
                                    }))
                                }), r.jsx("input", {
                                    className: "w-32 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-cyan-500",
                                    value: y.jiraKey ?? "",
                                    onChange: z => x(W => ({
                                        ...W,
                                        jiraKey: z.target.value.trim().toUpperCase()
                                    })),
                                    placeholder: "PKPI2-123"
                                })]
                            }), r.jsxs("div", {
                                className: "flex justify-end gap-2",
                                children: [r.jsx("button", {
                                    onClick: () => k(null),
                                    className: "rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200",
                                    children: "Cancel"
                                }), r.jsx("button", {
                                    onClick: () => V(I),
                                    disabled: C,
                                    className: "rounded-lg bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-600 disabled:opacity-50",
                                    children: C ? "Saving…" : "Save"
                                })]
                            })]
                        }) : r.jsxs("div", {
                            className: "flex items-start justify-between gap-3",
                            children: [r.jsxs("div", {
                                className: "flex-1 min-w-0",
                                children: [r.jsx("p", {
                                    className: "text-slate-200",
                                    children: P.description
                                }), r.jsxs("p", {
                                    className: "mt-0.5 text-xs text-slate-500",
                                    children: ["Owner: ", P.owner, P.dueDate ? ` · Due: ${P.dueDate}` : ""]
                                })]
                            }), r.jsxs("div", {
                                className: "flex shrink-0 items-center gap-2",
                                children: [b && !b.startsWith("Error") && r.jsx("a", {
                                    href: `${Vs}/${b}`,
                                    target: "_blank",
                                    rel: "noreferrer",
                                    className: "rounded-full bg-cyan-900/40 px-2 py-0.5 text-xs font-semibold text-cyan-300 hover:underline",
                                    children: b
                                }), (b == null ? void 0 : b.startsWith("Error")) && r.jsx("span", {
                                    className: "rounded-full bg-rose-900/40 px-2 py-0.5 text-xs text-rose-400",
                                    title: b,
                                    children: "Error"
                                }), r.jsx("button", {
                                    onClick: () => {
                                        k(I), x({
                                            ...P,
                                            jiraKey: b && !b.startsWith("Error") ? b : ""
                                        })
                                    },
                                    className: "rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200",
                                    children: "Edit"
                                }), N ? r.jsxs(r.Fragment, {
                                    children: [r.jsx("span", {
                                        className: "text-xs text-slate-400",
                                        children: "Delete?"
                                    }), r.jsx("button", {
                                        onClick: () => B(I),
                                        className: "rounded-lg bg-rose-700 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-600",
                                        children: "Yes"
                                    }), r.jsx("button", {
                                        onClick: () => w(null),
                                        className: "rounded-lg border border-slate-600 px-2 py-1 text-xs text-slate-400 hover:text-slate-200",
                                        children: "No"
                                    })]
                                }) : r.jsx("button", {
                                    onClick: () => w(I),
                                    className: "rounded-lg bg-rose-700 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-600",
                                    children: "Delete"
                                })]
                            })]
                        })
                    }, I)
                })
            })]
        }), r.jsxs("div", {
            className: "rounded-xl border border-slate-800 bg-slate-900/70 p-4",
            children: [r.jsx("h3", {
                className: "mb-3 font-semibold text-violet-300",
                children: "Decisions"
            }), i.decisions.length === 0 ? r.jsx("p", {
                className: "text-sm text-slate-500",
                children: "No decisions recorded."
            }) : r.jsx("div", {
                className: "space-y-2",
                children: i.decisions.map((P, I) => {
                    var N, $;
                    const b = (N = i.decisionItems) == null ? void 0 : N[I],
                        E = ($ = i.decisionJiraTickets) == null ? void 0 : $[P];
                    return r.jsx("div", {
                        className: "rounded-lg bg-slate-950/60 px-3 py-2 text-sm",
                        children: r.jsxs("div", {
                            className: "flex items-start justify-between gap-3",
                            children: [r.jsxs("div", {
                                className: "flex-1 min-w-0",
                                children: [r.jsx("p", {
                                    className: "text-slate-200",
                                    children: P
                                }), (b == null ? void 0 : b.owner) && r.jsxs("p", {
                                    className: "mt-0.5 text-xs text-slate-500",
                                    children: ["Owner: ", b.owner, " · Decided: ", i.date]
                                })]
                            }), E && !E.startsWith("Error") && r.jsx("a", {
                                href: `${Vs}/${E}`,
                                target: "_blank",
                                rel: "noreferrer",
                                className: "shrink-0 rounded-full bg-violet-900/40 px-2 py-0.5 text-xs font-semibold text-violet-300 hover:underline",
                                children: E
                            }), (E == null ? void 0 : E.startsWith("Error")) && r.jsx("span", {
                                className: "shrink-0 rounded-full bg-rose-900/40 px-2 py-0.5 text-xs text-rose-400",
                                title: E,
                                children: "Error"
                            })]
                        })
                    }, I)
                })
            })]
        }), r.jsxs("div", {
            className: "rounded-xl border border-slate-800 bg-slate-900/70 p-4",
            children: [r.jsx("h3", {
                className: "mb-2 font-semibold text-emerald-300",
                children: "Key Points"
            }), i.keyPoints.length === 0 ? r.jsx("p", {
                className: "text-sm text-slate-500",
                children: "None recorded."
            }) : r.jsx("ul", {
                className: "space-y-1",
                children: i.keyPoints.map((P, I) => r.jsxs("li", {
                    className: "text-sm text-slate-300",
                    children: ["• ", P]
                }, I))
            })]
        }), r.jsx(_i, {
            meeting: i,
            meetingKey: e,
            onMeetingUpdate: c,
            contacts: s,
            onContactsChange: a
        }), r.jsx(Ti, {
            meeting: i,
            meetingKey: e
        })]
    })
}

function Di({
    onSelect: e,
    refresh: t,
    onRefresh: n
}) {
    const [o, s] = g.useState([]), [a, i] = g.useState(!0), [c, d] = g.useState(null), [u, p] = g.useState(null), [h, m] = g.useState(null);
    g.useEffect(() => {
        i(!0), Y("/meetings/").then(y => y.json()).then(y => {
            const x = y.objects.filter(S => S.key.endsWith(".json"));
            x.sort((S, w) => w.uploaded.localeCompare(S.uploaded)), s(x)
        }).catch(y => d(y.message)).finally(() => i(!1))
    }, [t]);
    const k = async y => {
        p(null), m(y);
        try {
            await Y(`/${y}`, {
                method: "DELETE"
            });
            const x = y.replace(".json", ".docx");
            await Y(`/${x}`, {
                method: "DELETE"
            }).catch(() => {}), n()
        } catch (x) {
            alert(`Delete failed: ${x.message}`)
        } finally {
            m(null)
        }
    };
    return a ? r.jsx("div", {
        className: "py-8 text-center text-slate-400",
        children: "Loading meetings..."
    }) : c ? r.jsxs("div", {
        className: "py-8 text-center text-rose-400",
        children: ["Failed to load: ", c]
    }) : o.length === 0 ? r.jsx("div", {
        className: "py-8 text-center text-slate-500",
        children: "No meetings uploaded yet. Upload a DOCX above to get started."
    }) : r.jsx("div", {
        className: "space-y-2",
        children: o.map(y => {
            const x = y.key.replace("meetings/", "").replace(".json", "").split("-"),
                S = x.slice(0, 3).join("-"),
                w = x.slice(3).join(" ").replace(/-/g, " "),
                C = u === y.key,
                D = h === y.key;
            return r.jsxs("div", {
                className: "flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 transition hover:border-cyan-700 hover:bg-slate-800/70",
                children: [r.jsxs("button", {
                    className: "flex-1 text-left",
                    onClick: () => e(y.key),
                    children: [r.jsx("p", {
                        className: "font-semibold capitalize text-slate-200",
                        children: w || y.key
                    }), r.jsxs("p", {
                        className: "mt-0.5 text-xs text-slate-500",
                        children: [S, " · ", (y.size / 1024).toFixed(1), " KB"]
                    })]
                }), r.jsx("div", {
                    className: "flex items-center gap-2",
                    children: C ? r.jsxs(r.Fragment, {
                        children: [r.jsx("span", {
                            className: "text-xs text-slate-300",
                            children: "Are you sure you want to delete?"
                        }), r.jsx("button", {
                            onClick: () => k(y.key),
                            className: "rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600 active:bg-rose-800",
                            children: "Yes"
                        }), r.jsx("button", {
                            onClick: () => p(null),
                            className: "rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700",
                            children: "Cancel"
                        })]
                    }) : r.jsxs(r.Fragment, {
                        children: [r.jsx("span", {
                            className: "text-slate-600",
                            children: "→"
                        }), r.jsx("button", {
                            onClick: M => {
                                M.stopPropagation(), p(y.key)
                            },
                            disabled: D,
                            className: "ml-2 rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600 active:bg-rose-800 disabled:opacity-40",
                            children: D ? "Deleting…" : "Delete"
                        })]
                    })
                })]
            }, y.key)
        })
    })
}

function Ii() {
    const [e, t] = g.useState({
        stage: "idle",
        message: ""
    }), [n, o] = g.useState(null), [s, a] = g.useState(0), [i, c] = g.useState("Selleys"), [d, u] = g.useState(null), [p, h] = g.useState([]), [m, k] = g.useState([]), [y, x] = g.useState([]), [S, w] = g.useState([]), [C, D] = g.useState([]), [M, A] = g.useState([]), [_, T] = g.useState([]), [V, B] = g.useState([]), [P, I] = g.useState(""), b = g.useRef(null);
    g.useEffect(() => {
        hi().then(T), mi().then(B)
    }, []);
    const E = async O => {
        if (!O.name.endsWith(".docx")) {
            t({
                stage: "error",
                message: "Please upload a .docx file."
            });
            return
        }
        try {
            t({
                stage: "extracting",
                message: "Extracting text from DOCX..."
            });
            const U = await xs(O);
            if (U.length < 50) throw new Error("Could not extract enough text. Please check the file.");
            t({
                stage: "parsing",
                message: "Parsing meeting with AI..."
            });
            const L = await fi(U, O.name),
                F = O.name.replace(/[^a-z0-9]/gi, "-").toLowerCase(),
                J = `meetings/${L.date}-${F}.json`,
                H = `meetings/${L.date}-${F}.docx`;
            h(L.actionItems.map(() => 1)), k(L.actionItems.map(() => !0)), x(L.actionItems.map(() => !1)), w(L.actionItems.map(ie => ie.dueDate || "")), D(L.decisions.map(() => "")), A(L.decisions.map(() => !0)), u({
                parsed: L,
                file: O,
                jsonKey: J,
                docxKey: H
            });
            const ne = L.title.toLowerCase(),
                Q = _.find(ie => ne.includes(ie.name.toLowerCase()) || ne.includes(ie.id.toLowerCase().replace(/-/g, " ")));
            I((Q == null ? void 0 : Q.id) ?? ""), t({
                stage: "idle",
                message: ""
            })
        } catch (U) {
            t({
                stage: "error",
                message: U.message || "Something went wrong."
            })
        }
    }, N = async () => {
        if (!d) return;
        const {
            parsed: O,
            file: U,
            jsonKey: L,
            docxKey: F
        } = d;
        try {
            t({
                stage: "saving",
                message: "Saving transcript to R2..."
            }), await gi(U, F);
            const J = O.actionItems.filter((R, G) => !y[G] && m[G]).length,
                H = O.decisions.filter((R, G) => M[G]).length;
            t({
                stage: "tickets",
                message: `Creating ${J+H} Jira ticket(s)...`
            });
            const ne = _.find(R => R.id === P),
                Q = {};
            for (let R = 0; R < O.actionItems.length; R++) {
                if (y[R] || !m[R]) continue;
                const G = {
                    ...O.actionItems[R],
                    dueDate: S[R] ?? O.actionItems[R].dueDate
                };
                try {
                    Q[G.description] = await yi(G, O.title, O.date, i, Gs[p[R] ?? 1], P || void 0, ne == null ? void 0 : ne.name)
                } catch (te) {
                    Q[G.description] = `Error: ${te.message}`
                }
            }
            const ie = {};
            for (let R = 0; R < O.decisions.length; R++) {
                if (!M[R]) continue;
                const G = {
                    description: O.decisions[R],
                    owner: C[R] || "Simon Lobascher"
                };
                try {
                    ie[G.description] = await bi(G, O.title, O.date, i, P || void 0, ne == null ? void 0 : ne.name)
                } catch (te) {
                    ie[G.description] = `Error: ${te.message}`
                }
            }
            const v = O.decisions.map((R, G) => ({
                    description: R,
                    owner: C[G] || "Simon Lobascher"
                })),
                K = {
                    ...O,
                    actionItems: O.actionItems.map((R, G) => ({
                        ...R,
                        dueDate: S[G] ?? R.dueDate
                    })).filter((R, G) => !y[G]),
                    decisionItems: v,
                    uploadedAt: new Date().toISOString(),
                    sourceFile: U.name,
                    jiraTickets: Q,
                    decisionJiraTickets: ie,
                    docxKey: F,
                    ...P ? {
                        projectId: P
                    } : {}
                };
            await jt(K, L), u(null), t({
                stage: "done",
                message: "Done!"
            }), a(R => R + 1), o(L)
        } catch (J) {
            t({
                stage: "error",
                message: J.message || "Something went wrong."
            })
        }
    }, $ = O => {
        var L;
        const U = (L = O.target.files) == null ? void 0 : L[0];
        U && E(U), O.target.value = ""
    }, z = O => {
        var L;
        O.preventDefault();
        const U = (L = O.dataTransfer.files) == null ? void 0 : L[0];
        U && E(U)
    }, W = ["extracting", "parsing", "saving", "tickets"].includes(e.stage);
    return r.jsxs("div", {
        className: "space-y-6",
        children: [W && r.jsxs("div", {
            className: "rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-center",
            children: [r.jsx("div", {
                className: "mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400"
            }), r.jsx("p", {
                className: "text-slate-200",
                children: e.message
            })]
        }), !W && d && r.jsxs("div", {
            className: "space-y-4 rounded-2xl border border-slate-700 bg-slate-900/70 p-5",
            children: [r.jsxs("div", {
                className: "flex flex-wrap items-start justify-between gap-3",
                children: [r.jsxs("div", {
                    children: [r.jsx("h2", {
                        className: "text-lg font-bold text-slate-100",
                        children: d.parsed.title
                    }), r.jsxs("p", {
                        className: "text-sm text-slate-400",
                        children: [d.parsed.date, " · ", d.parsed.participants.length, " attendees"]
                    })]
                }), r.jsxs("div", {
                    className: "flex gap-3",
                    children: [r.jsx(Ur, {
                        projects: _,
                        value: P,
                        onChange: I,
                        onProjectsChange: T
                    }), r.jsxs("div", {
                        className: "flex flex-col gap-1",
                        children: [r.jsx("label", {
                            className: "text-xs font-semibold text-slate-400",
                            children: "SBU"
                        }), r.jsx("select", {
                            value: i,
                            onChange: O => c(O.target.value),
                            className: "rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-cyan-500",
                            children: xi.map(O => r.jsx("option", {
                                value: O,
                                children: O
                            }, O))
                        })]
                    })]
                })]
            }), r.jsxs("div", {
                children: [r.jsx("h3", {
                    className: "mb-2 font-semibold text-amber-300",
                    children: "Actions"
                }), r.jsx("div", {
                    className: "space-y-2",
                    children: d.parsed.actionItems.map((O, U) => {
                        if (y[U]) return null;
                        const L = m[U] ?? !0;
                        return r.jsxs("div", {
                            className: `flex items-start gap-3 rounded-lg px-3 py-2.5 ${L?"bg-slate-950/60":"bg-slate-950/30 opacity-50"}`,
                            children: [r.jsx("input", {
                                type: "checkbox",
                                checked: L,
                                onChange: () => k(F => {
                                    const J = [...F];
                                    return J[U] = !J[U], J
                                }),
                                className: "mt-0.5 shrink-0 accent-cyan-500 h-4 w-4 cursor-pointer",
                                title: "Create Jira ticket for this action"
                            }), r.jsxs("div", {
                                className: "flex-1 min-w-0",
                                children: [r.jsx("p", {
                                    className: "text-sm text-slate-200",
                                    children: O.description
                                }), r.jsxs("div", {
                                    className: "mt-1 flex items-center gap-2",
                                    children: [r.jsxs("span", {
                                        className: "text-xs text-slate-500",
                                        children: ["Owner: ", O.owner]
                                    }), r.jsx("input", {
                                        type: "date",
                                        value: S[U] ?? "",
                                        onChange: F => w(J => {
                                            const H = [...J];
                                            return H[U] = F.target.value, H
                                        }),
                                        disabled: !L,
                                        className: "rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-300 outline-none focus:border-cyan-500 disabled:opacity-40",
                                        title: "Due date"
                                    })]
                                }), !L && r.jsx("p", {
                                    className: "mt-0.5 text-xs text-slate-600 italic",
                                    children: "No Jira ticket will be created"
                                })]
                            }), r.jsx("select", {
                                value: p[U] ?? 1,
                                onChange: F => h(J => {
                                    const H = [...J];
                                    return H[U] = Number(F.target.value), H
                                }),
                                disabled: !L,
                                className: "shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 outline-none focus:border-cyan-500 disabled:opacity-40",
                                children: Gs.map((F, J) => r.jsx("option", {
                                    value: J,
                                    children: F.label
                                }, F.label))
                            }), r.jsx("button", {
                                onClick: () => x(F => {
                                    const J = [...F];
                                    return J[U] = !0, J
                                }),
                                className: "shrink-0 rounded-lg bg-rose-700 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-600",
                                title: "Remove this action",
                                children: "✕"
                            })]
                        }, U)
                    })
                })]
            }), d.parsed.decisions.length > 0 && r.jsxs("div", {
                children: [r.jsx("h3", {
                    className: "mb-2 font-semibold text-violet-300",
                    children: "Decisions"
                }), r.jsx("p", {
                    className: "mb-2 text-xs text-slate-500",
                    children: "Assign an owner to each decision — a Jira ticket will be created to track accountability."
                }), r.jsx("div", {
                    className: "space-y-2",
                    children: d.parsed.decisions.map((O, U) => {
                        const L = M[U] ?? !0;
                        return r.jsxs("div", {
                            className: `flex items-start gap-3 rounded-lg px-3 py-2.5 ${L?"bg-slate-950/60":"bg-slate-950/30 opacity-50"}`,
                            children: [r.jsx("input", {
                                type: "checkbox",
                                checked: L,
                                onChange: () => A(F => {
                                    const J = [...F];
                                    return J[U] = !J[U], J
                                }),
                                className: "mt-0.5 shrink-0 accent-violet-500 h-4 w-4 cursor-pointer",
                                title: "Create Jira ticket for this decision"
                            }), r.jsxs("div", {
                                className: "flex-1 min-w-0",
                                children: [r.jsx("p", {
                                    className: "text-sm text-slate-200",
                                    children: O
                                }), !L && r.jsx("p", {
                                    className: "mt-0.5 text-xs text-slate-600 italic",
                                    children: "No Jira ticket will be created"
                                })]
                            }), r.jsx("input", {
                                value: C[U] ?? "",
                                onChange: F => D(J => {
                                    const H = [...J];
                                    return H[U] = F.target.value, H
                                }),
                                disabled: !L,
                                placeholder: "Owner name",
                                className: "w-40 shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 outline-none focus:border-violet-500 disabled:opacity-40"
                            })]
                        }, U)
                    })
                })]
            }), r.jsxs("div", {
                className: "flex gap-3",
                children: [r.jsx("button", {
                    onClick: N,
                    className: "rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-600",
                    children: "Confirm & Create Jira Tickets"
                }), r.jsx("button", {
                    onClick: () => {
                        u(null), t({
                            stage: "idle",
                            message: ""
                        })
                    },
                    className: "rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:text-slate-200",
                    children: "Cancel"
                })]
            })]
        }), !W && !d && r.jsxs("div", {
            onDrop: z,
            onDragOver: O => O.preventDefault(),
            onClick: () => {
                var O;
                return (O = b.current) == null ? void 0 : O.click()
            },
            className: "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/50 p-8 text-center transition hover:border-cyan-500 hover:bg-slate-800/50",
            children: [r.jsx("p", {
                className: "text-xl text-slate-400",
                children: "📄"
            }), r.jsx("p", {
                className: "mt-1 font-semibold text-slate-200",
                children: "Drop a meeting DOCX here to upload"
            }), r.jsx("p", {
                className: "text-sm text-slate-500",
                children: "or click to browse"
            }), e.stage === "error" && r.jsx("p", {
                className: "mt-2 text-sm text-rose-400",
                children: e.message
            }), r.jsx("input", {
                ref: b,
                type: "file",
                accept: ".docx",
                className: "hidden",
                onChange: $
            })]
        }), !W && !d && (n ? r.jsx(Pi, {
            meetingKey: n,
            onBack: () => o(null),
            projects: _,
            onProjectsChange: T,
            contacts: V,
            onContactsChange: B
        }) : r.jsxs("div", {
            children: [r.jsx("h3", {
                className: "mb-3 text-lg font-semibold text-slate-300",
                children: "Uploaded Meetings"
            }), r.jsx(Di, {
                onSelect: o,
                refresh: s,
                onRefresh: () => a(O => O + 1)
            })]
        }))]
    })
}
const Oi = {
        generatedAt: "2026-02-17T11:14:16.700802Z",
        owner: {
            name: "Simon Lobascher"
        },
        scopeNote: "Includes your assigned/reported tickets, active Selleys/Yates tickets in EPM/DLWLC, and any ticket with Project Type = AI.",
        totals: {
            allTickets: 22,
            totalInitiatives: 22,
            overdueItems: 1,
            completed: 6,
            activeTickets: 16,
            aiProjectTypeTickets: 5
        },
        demandOpenClosed: {
            open: 16,
            closed: 6
        },
        deliveryOpenClosed: {
            open: 0,
            closed: 0
        },
        categoryBreakdown: {
            Strategic: 22,
            Tactical: 0,
            "Ad hoc": 0
        },
        agingBucketsActive: {
            "0-30": 12,
            "31-60": 0,
            "61-90": 1,
            "90+": 0,
            Unknown: 3
        }
    },
    Li = [{
        key: "DLWLC-410",
        url: "https://duluxgroup.atlassian.net/browse/DLWLC-410",
        summary: "S&A Tooling - LeanIX",
        status: "In Progress",
        rag: "Green",
        issueType: "Initiative",
        projectKey: "DLWLC",
        projectName: "IT&DE Lightweight Lean Canvas",
        projectType: "service_desk",
        projectTypeTags: [],
        projectTypeValue: "Not yet classified",
        labels: [],
        startDate: "2025-09-01",
        endDate: "2026-06-30",
        dueDate: "2026-06-30",
        created: "2025-06-03",
        resolved: null,
        assignee: "Simon Lobascher",
        reporter: "Karen Jeffery",
        priority: "Medium",
        agingDays: 0,
        agingBucket: "0-30",
        isDone: !1,
        isOverdue: !1,
        stream: "Demand",
        category: "Strategic",
        brand: "Other",
        active: !0
    }, {
        key: "DLWLC-462",
        url: "https://duluxgroup.atlassian.net/browse/DLWLC-462",
        summary: "Selleys Purchasing EDI Implementations",
        status: "In Progress",
        rag: "Green",
        issueType: "Initiative",
        projectKey: "DLWLC",
        projectName: "IT&DE Lightweight Lean Canvas",
        projectType: "service_desk",
        projectTypeTags: [],
        projectTypeValue: "Not yet classified",
        labels: [],
        startDate: "2025-07-01",
        endDate: "2026-06-30",
        dueDate: "2026-06-30",
        created: "2025-06-20",
        resolved: null,
        assignee: "Trevor Ward",
        reporter: "Karen Jeffery",
        priority: "Medium",
        agingDays: 0,
        agingBucket: "0-30",
        isDone: !1,
        isOverdue: !1,
        stream: "Demand",
        category: "Strategic",
        brand: "Selleys",
        active: !0
    }, {
        key: "EPM-161",
        url: "https://duluxgroup.atlassian.net/browse/EPM-161",
        summary: "Selleys - UKG Tactical Optimisation (Interim Approach)",
        status: "Selected for Development",
        rag: "Green",
        issueType: "Initiative",
        projectKey: "EPM",
        projectName: "IT&DE-Portfolio Management",
        projectType: "software",
        projectTypeTags: ["Operational/Tactical"],
        projectTypeValue: "Operational/Tactical",
        labels: ["Bowerbird", "Core-Modernisation-Dependency", "Interim", "Payroll", "Selleys", "Tactical-Optimisation", "TimeAndAttendance", "UKG"],
        startDate: "2026-02-18",
        endDate: "2026-03-31",
        dueDate: "2026-03-31",
        created: "2026-02-17",
        resolved: null,
        assignee: "Simon Lobascher",
        reporter: "Simon Lobascher",
        priority: "High",
        agingDays: 0,
        agingBucket: "0-30",
        isDone: !1,
        isOverdue: !1,
        stream: "Demand",
        category: "Strategic",
        brand: "Selleys",
        active: !0
    }, {
        key: "DLWLC-526",
        url: "https://duluxgroup.atlassian.net/browse/DLWLC-526",
        summary: "Project Olive - Pinegro IT Integration (M&A)",
        status: "Discovery",
        rag: "Green",
        issueType: "Initiative",
        projectKey: "DLWLC",
        projectName: "IT&DE Lightweight Lean Canvas",
        projectType: "service_desk",
        projectTypeTags: [],
        projectTypeValue: "Not yet classified",
        labels: [],
        startDate: "2025-10-01",
        endDate: "2026-03-31",
        dueDate: "2026-03-31",
        created: "2025-09-17",
        resolved: null,
        assignee: "Karen Jeffery",
        reporter: "Tim Schmidt",
        priority: "Medium",
        agingDays: 0,
        agingBucket: "0-30",
        isDone: !1,
        isOverdue: !1,
        stream: "Demand",
        category: "Strategic",
        brand: "Other",
        active: !0
    }, {
        key: "DLWLC-45",
        url: "https://duluxgroup.atlassian.net/browse/DLWLC-45",
        summary: "Project Bowerbird",
        status: "In Progress",
        rag: "Green",
        issueType: "Initiative",
        projectKey: "DLWLC",
        projectName: "IT&DE Lightweight Lean Canvas",
        projectType: "service_desk",
        projectTypeTags: ["Operational/Tactical"],
        projectTypeValue: "Operational/Tactical",
        labels: [],
        startDate: "2023-01-01",
        endDate: "2027-04-01",
        dueDate: "2027-04-01",
        created: "2022-08-24",
        resolved: null,
        assignee: "Matt Clements",
        reporter: "Karen Jeffery",
        priority: "Medium",
        agingDays: 0,
        agingBucket: "0-30",
        isDone: !1,
        isOverdue: !1,
        stream: "Demand",
        category: "Strategic",
        brand: "Other",
        active: !0
    }, {
        key: "EPM-148",
        url: "https://duluxgroup.atlassian.net/browse/EPM-148",
        summary: "Yates onboarding 3rd party platform support",
        status: "Discovery",
        rag: "Green",
        issueType: "Initiative",
        projectKey: "EPM",
        projectName: "IT&DE-Portfolio Management",
        projectType: "software",
        projectTypeTags: ["AI"],
        projectTypeValue: "AI",
        labels: [],
        startDate: "2026-02-10",
        endDate: null,
        dueDate: null,
        created: "2026-02-04",
        resolved: null,
        assignee: "Simon Lobascher",
        reporter: "Sam Bochiwal",
        priority: "Medium",
        agingDays: null,
        agingBucket: "Unknown",
        isDone: !1,
        isOverdue: !1,
        stream: "Demand",
        category: "Strategic",
        brand: "Yates",
        active: !0
    }, {
        key: "EPM-155",
        url: "https://duluxgroup.atlassian.net/browse/EPM-155",
        summary: "Selleys Marketing - Automate content ideation and production using AI",
        status: "Selected for Development",
        rag: "Green",
        issueType: "Initiative",
        projectKey: "EPM",
        projectName: "IT&DE-Portfolio Management",
        projectType: "software",
        projectTypeTags: ["AI"],
        projectTypeValue: "AI",
        labels: ["AI", "Marketing", "Selleys", "agentic-ai", "automation", "content-generation", "innovation-goblins", "rapid-prototype"],
        startDate: "2026-02-17",
        endDate: null,
        dueDate: null,
        created: "2026-02-17",
        resolved: null,
        assignee: "Simon Lobascher",
        reporter: "Simon Lobascher",
        priority: "High",
        agingDays: null,
        agingBucket: "Unknown",
        isDone: !1,
        isOverdue: !1,
        stream: "Demand",
        category: "Strategic",
        brand: "Selleys",
        active: !0
    }, {
        key: "DLWLC-334",
        url: "https://duluxgroup.atlassian.net/browse/DLWLC-334",
        summary: "Document Control System",
        status: "Backlog",
        rag: "Green",
        issueType: "Initiative",
        projectKey: "DLWLC",
        projectName: "IT&DE Lightweight Lean Canvas",
        projectType: "service_desk",
        projectTypeTags: [],
        projectTypeValue: "Not yet classified",
        labels: [],
        startDate: "2026-09-01",
        endDate: "2026-12-18",
        dueDate: "2026-12-18",
        created: "2025-02-13",
        resolved: null,
        assignee: "Jared Roberts",
        reporter: "Jared Roberts",
        priority: "Medium",
        agingDays: 0,
        agingBucket: "0-30",
        isDone: !1,
        isOverdue: !1,
        stream: "Demand",
        category: "Strategic",
        brand: "Other",
        active: !0
    }, {
        key: "EPM-144",
        url: "https://duluxgroup.atlassian.net/browse/EPM-144",
        summary: "Umbraco Platform Uplift to V17 - Design & POC",
        status: "Discovery",
        rag: "Green",
        issueType: "Initiative",
        projectKey: "EPM",
        projectName: "IT&DE-Portfolio Management",
        projectType: "software",
        projectTypeTags: [],
        projectTypeValue: "Not yet classified",
        labels: [],
        startDate: "2026-02-02",
        endDate: "2026-04-23",
        dueDate: "2026-04-23",
        created: "2026-02-02",
        resolved: null,
        assignee: "Naveen Narasappa",
        reporter: "Naveen Narasappa",
        priority: "Medium",
        agingDays: 0,
        agingBucket: "0-30",
        isDone: !1,
        isOverdue: !1,
        stream: "Demand",
        category: "Strategic",
        brand: "Other",
        active: !0
    }, {
        key: "DLWLC-362",
        url: "https://duluxgroup.atlassian.net/browse/DLWLC-362",
        summary: "Telephony Transformation - Corporate",
        status: "In Progress",
        rag: "Green",
        issueType: "Initiative",
        projectKey: "DLWLC",
        projectName: "IT&DE Lightweight Lean Canvas",
        projectType: "service_desk",
        projectTypeTags: [],
        projectTypeValue: "Not yet classified",
        labels: [],
        startDate: "2025-01-01",
        endDate: "2026-12-31",
        dueDate: "2026-12-31",
        created: "2025-03-25",
        resolved: null,
        assignee: "Andi Widhibrata",
        reporter: "Tim Schmidt",
        priority: "Medium",
        agingDays: 0,
        agingBucket: "0-30",
        isDone: !1,
        isOverdue: !1,
        stream: "Demand",
        category: "Strategic",
        brand: "Other",
        active: !0
    }, {
        key: "DLWLC-567",
        url: "https://duluxgroup.atlassian.net/browse/DLWLC-567",
        summary: "Process Planning for Rocklea",
        status: "Ideation",
        rag: "Green",
        issueType: "Epic",
        projectKey: "DLWLC",
        projectName: "IT&DE Lightweight Lean Canvas",
        projectType: "service_desk",
        projectTypeTags: ["AI"],
        projectTypeValue: "AI",
        labels: [],
        startDate: "2025-11-01",
        endDate: "2025-11-30",
        dueDate: "2025-11-30",
        created: "2026-02-02",
        resolved: "2026-02-02",
        assignee: "Luke Williams",
        reporter: "Luke Williams",
        priority: "Medium",
        agingDays: 79,
        agingBucket: "61-90",
        isDone: !1,
        isOverdue: !0,
        stream: "Demand",
        category: "Strategic",
        brand: "Other",
        active: !0
    }, {
        key: "EPM-109",
        url: "https://duluxgroup.atlassian.net/browse/EPM-109",
        summary: "Innovation Council - NPD Platform - Phase 4 AI Integration",
        status: "On Hold",
        rag: "Green",
        issueType: "Initiative",
        projectKey: "EPM",
        projectName: "IT&DE-Portfolio Management",
        projectType: "software",
        projectTypeTags: ["AI", "Operational/Tactical"],
        projectTypeValue: "AI",
        labels: [],
        startDate: "2026-01-13",
        endDate: null,
        dueDate: null,
        created: "2026-01-13",
        resolved: null,
        assignee: "Jared Roberts",
        reporter: "Drivesha Prayag",
        priority: "Medium",
        agingDays: null,
        agingBucket: "Unknown",
        isDone: !1,
        isOverdue: !1,
        stream: "Demand",
        category: "Strategic",
        brand: "Other",
        active: !0
    }, {
        key: "DLWLC-470",
        url: "https://duluxgroup.atlassian.net/browse/DLWLC-470",
        summary: "Power BI Pental SAP+Pronto ",
        status: "In Progress",
        rag: "Green",
        issueType: "Initiative",
        projectKey: "DLWLC",
        projectName: "IT&DE Lightweight Lean Canvas",
        projectType: "service_desk",
        projectTypeTags: [],
        projectTypeValue: "Not yet classified",
        labels: [],
        startDate: "2025-07-17",
        endDate: "2026-03-31",
        dueDate: "2026-03-31",
        created: "2025-07-15",
        resolved: null,
        assignee: "Anbu Ekambaram",
        reporter: "Anbu Ekambaram",
        priority: "Medium",
        agingDays: 0,
        agingBucket: "0-30",
        isDone: !1,
        isOverdue: !1,
        stream: "Demand",
        category: "Strategic",
        brand: "Other",
        active: !0
    }, {
        key: "DLWLC-295",
        url: "https://duluxgroup.atlassian.net/browse/DLWLC-295",
        summary: "Umbraco Remediation",
        status: "In Progress",
        rag: "Green",
        issueType: "Initiative",
        projectKey: "DLWLC",
        projectName: "IT&DE Lightweight Lean Canvas",
        projectType: "service_desk",
        projectTypeTags: ["Regulatory/Compliance"],
        projectTypeValue: "Regulatory/Compliance",
        labels: [],
        startDate: "2024-06-03",
        endDate: "2026-02-27",
        dueDate: "2026-02-27",
        created: "2024-10-08",
        resolved: null,
        assignee: "Naveen Narasappa",
        reporter: "Melvin Lim",
        priority: "High",
        agingDays: 0,
        agingBucket: "0-30",
        isDone: !1,
        isOverdue: !1,
        stream: "Demand",
        category: "Strategic",
        brand: "Other",
        active: !0
    }, {
        key: "DLWLC-427",
        url: "https://duluxgroup.atlassian.net/browse/DLWLC-427",
        summary: "Deploy predictive analytics and real-time risk dashboards",
        status: "Discovery",
        rag: "Green",
        issueType: "Initiative",
        projectKey: "DLWLC",
        projectName: "IT&DE Lightweight Lean Canvas",
        projectType: "service_desk",
        projectTypeTags: ["AI"],
        projectTypeValue: "AI",
        labels: [],
        startDate: "2025-07-01",
        endDate: "2026-12-31",
        dueDate: "2026-12-31",
        created: "2025-06-05",
        resolved: null,
        assignee: "Luke Williams",
        reporter: "Karen Jeffery",
        priority: "Medium",
        agingDays: 0,
        agingBucket: "0-30",
        isDone: !1,
        isOverdue: !1,
        stream: "Demand",
        category: "Strategic",
        brand: "Other",
        active: !0
    }, {
        key: "DLWLC-414",
        url: "https://duluxgroup.atlassian.net/browse/DLWLC-414",
        summary: "E2E DG Delivery Framework (linking Strategy to Execution) - Rollout EDF to SBUs",
        status: "In Progress",
        rag: "Green",
        issueType: "Initiative",
        projectKey: "DLWLC",
        projectName: "IT&DE Lightweight Lean Canvas",
        projectType: "service_desk",
        projectTypeTags: [],
        projectTypeValue: "Not yet classified",
        labels: [],
        startDate: "2025-02-03",
        endDate: "2026-12-31",
        dueDate: "2026-12-31",
        created: "2025-06-05",
        resolved: null,
        assignee: "Nat Thangaraju",
        reporter: "Karen Jeffery",
        priority: "Medium",
        agingDays: 0,
        agingBucket: "0-30",
        isDone: !1,
        isOverdue: !1,
        stream: "Demand",
        category: "Strategic",
        brand: "Other",
        active: !0
    }, {
        key: "DLWLC-285",
        url: "https://duluxgroup.atlassian.net/browse/DLWLC-285",
        summary: "Digital Asset Management (DAM) for Selleys",
        status: "Done",
        rag: "Green",
        issueType: "Initiative",
        projectKey: "DLWLC",
        projectName: "IT&DE Lightweight Lean Canvas",
        projectType: "service_desk",
        projectTypeTags: ["Strategic"],
        projectTypeValue: "Strategic",
        labels: [],
        startDate: "2024-09-16",
        endDate: "2025-06-30",
        dueDate: "2025-06-30",
        created: "2024-09-05",
        resolved: null,
        assignee: "Naveen Narasappa",
        reporter: "Simon Lobascher",
        priority: "Medium",
        agingDays: 232,
        agingBucket: "90+",
        isDone: !0,
        isOverdue: !1,
        stream: "Demand",
        category: "Strategic",
        brand: "Selleys",
        active: !1
    }, {
        key: "DLWLC-278",
        url: "https://duluxgroup.atlassian.net/browse/DLWLC-278",
        summary: "Selley's Data Quality Remediation",
        status: "Closed",
        rag: "Green",
        issueType: "Initiative",
        projectKey: "DLWLC",
        projectName: "IT&DE Lightweight Lean Canvas",
        projectType: "service_desk",
        projectTypeTags: [],
        projectTypeValue: "Not yet classified",
        labels: [],
        startDate: "2024-08-06",
        endDate: null,
        dueDate: null,
        created: "2024-08-06",
        resolved: "2025-07-16",
        assignee: "Simon Lobascher",
        reporter: "Simon Lobascher",
        priority: "Medium",
        agingDays: null,
        agingBucket: "Unknown",
        isDone: !0,
        isOverdue: !1,
        stream: "Demand",
        category: "Strategic",
        brand: "Other",
        active: !1
    }, {
        key: "DLWLC-326",
        url: "https://duluxgroup.atlassian.net/browse/DLWLC-326",
        summary: "Selleys Trade Pricing Control",
        status: "Done",
        rag: "Green",
        issueType: "Initiative",
        projectKey: "DLWLC",
        projectName: "IT&DE Lightweight Lean Canvas",
        projectType: "service_desk",
        projectTypeTags: ["Regulatory/Compliance"],
        projectTypeValue: "Regulatory/Compliance",
        labels: [],
        startDate: "2025-02-03",
        endDate: "2025-03-28",
        dueDate: "2025-03-28",
        created: "2025-01-29",
        resolved: null,
        assignee: "Simon Lobascher",
        reporter: "Simon Lobascher",
        priority: "Medium",
        agingDays: 326,
        agingBucket: "90+",
        isDone: !0,
        isOverdue: !1,
        stream: "Demand",
        category: "Strategic",
        brand: "Selleys",
        active: !1
    }, {
        key: "DLWLC-348",
        url: "https://duluxgroup.atlassian.net/browse/DLWLC-348",
        summary: "Selleys program management",
        status: "Closed",
        rag: "Green",
        issueType: "Initiative",
        projectKey: "DLWLC",
        projectName: "IT&DE Lightweight Lean Canvas",
        projectType: "service_desk",
        projectTypeTags: [],
        projectTypeValue: "Not yet classified",
        labels: [],
        startDate: "2025-03-04",
        endDate: null,
        dueDate: null,
        created: "2025-03-04",
        resolved: "2025-03-11",
        assignee: "Simon Lobascher",
        reporter: "Kevin Lurie",
        priority: "Medium",
        agingDays: null,
        agingBucket: "Unknown",
        isDone: !0,
        isOverdue: !1,
        stream: "Demand",
        category: "Strategic",
        brand: "Selleys",
        active: !1
    }, {
        key: "DLWLC-280",
        url: "https://duluxgroup.atlassian.net/browse/DLWLC-280",
        summary: "Ratings and Review (Discovery)",
        status: "Closed",
        rag: "Green",
        issueType: "Initiative",
        projectKey: "DLWLC",
        projectName: "IT&DE Lightweight Lean Canvas",
        projectType: "service_desk",
        projectTypeTags: [],
        projectTypeValue: "Not yet classified",
        labels: [],
        startDate: "2024-08-06",
        endDate: null,
        dueDate: null,
        created: "2024-08-06",
        resolved: "2025-01-29",
        assignee: "Simon Lobascher",
        reporter: "Simon Lobascher",
        priority: "Medium",
        agingDays: null,
        agingBucket: "Unknown",
        isDone: !0,
        isOverdue: !1,
        stream: "Demand",
        category: "Strategic",
        brand: "Other",
        active: !1
    }, {
        key: "DLWLC-279",
        url: "https://duluxgroup.atlassian.net/browse/DLWLC-279",
        summary: "Admil Warehouse Management Solution",
        status: "Closed",
        rag: "Green",
        issueType: "Initiative",
        projectKey: "DLWLC",
        projectName: "IT&DE Lightweight Lean Canvas",
        projectType: "service_desk",
        projectTypeTags: [],
        projectTypeValue: "Not yet classified",
        labels: [],
        startDate: "2024-08-06",
        endDate: "2025-12-31",
        dueDate: "2025-12-31",
        created: "2024-08-06",
        resolved: "2025-01-29",
        assignee: "Simon Lobascher",
        reporter: "Simon Lobascher",
        priority: "Medium",
        agingDays: 0,
        agingBucket: "0-30",
        isDone: !0,
        isOverdue: !1,
        stream: "Demand",
        category: "Strategic",
        brand: "Other",
        active: !1
    }],
    Ai = {
        summary: Oi,
        tickets: Li
    },
    Ri = Ai,
    oe = ["#38bdf8", "#22c55e", "#f59e0b", "#ef4444", "#a78bfa", "#14b8a6", "#f43f5e", "#8b5cf6"];

function Ht(e) {
    const t = e.toLowerCase();
    return t.includes("red") ? "bg-rose-500/20 text-rose-300" : t.includes("amber") || t.includes("yellow") ? "bg-amber-500/20 text-amber-300" : t.includes("green") ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-500/20 text-slate-300"
}

function rt(e) {
    if (!e) return null;
    const t = new Date(e);
    return Number.isNaN(t.getTime()) ? null : t
}

function ds(e) {
    const t = rt(e);
    if (!t) return null;
    const n = new Date,
        o = new Date(t.getFullYear(), t.getMonth(), t.getDate()),
        a = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime() - o.getTime();
    return Math.round(a / 864e5)
}

function Ui(e, t) {
    const n = rt(t);
    if (!n) return "No due date";
    const o = rt(e);
    if (!o) return "Unknown completion date";
    const s = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    return new Date(o.getFullYear(), o.getMonth(), o.getDate()).getTime() <= s.getTime() ? "On Time" : "Late"
}

function Mr(e) {
    return Math.floor(e.getMonth() / 3) + 1
}

function Mi() {
    const e = [{
            key: "ALL",
            label: "ALL TIME",
            kind: "all",
            year: 0
        }],
        t = 2024,
        n = new Date,
        o = n.getFullYear(),
        s = Mr(n);
    for (let a = t; a <= o; a += 1) {
        const i = a === o ? s : 4;
        for (let c = 1; c <= i; c += 1) e.push({
            key: `Q${c}-${a}`,
            label: `QTR ${c} ${a}`,
            kind: "quarter",
            year: a,
            quarter: c
        })
    }
    for (let a = t; a <= o; a += 1) e.push({
        key: `ANNUAL-${a}`,
        label: `ANNUAL ${a}`,
        kind: "annual",
        year: a
    });
    return e
}

function Pe(e, t) {
    const n = new Map;
    for (const o of e) {
        const s = t(o) || "Unknown";
        n.set(s, (n.get(s) || 0) + 1)
    }
    return Array.from(n.entries()).map(([o, s]) => ({
        name: o,
        value: s
    })).sort((o, s) => s.value - o.value)
}

function Ve(e) {
    const t = e.toLowerCase().trim();
    return t.includes("90+") ? "90+" : t.includes("61-90") || t.includes("60-90") ? "61-90" : t.includes("31-60") || t.includes("30-60") ? "31-60" : t.includes("0-30") || t.includes("0 to 30") ? "0-30" : "Unknown"
}

function Js(e) {
    const t = ["90+", "61-90", "31-60", "0-30", "Unknown"],
        n = new Map;
    for (const o of e) {
        const s = Ve(o.name);
        n.set(s, (n.get(s) || 0) + o.value)
    }
    return t.map(o => ({
        name: o,
        value: n.get(o) || 0
    })).filter(o => o.value > 0)
}

function Bi(e) {
    return e === null ? "Unknown" : e > 90 ? "90+" : e > 60 ? "61-90" : e > 30 ? "31-60" : "0-30"
}

function Wi(e, t) {
    if (t.length > 0) return t[0];
    const n = e.join(" ").toLowerCase();
    return n.includes("selleys") ? "Selleys" : n.includes("yates") ? "Yates" : "Other"
}
async function Br(e, t, n) {
    const s = {
        jql: e,
        maxResults: t,
        fields: ["summary", "status", "issuetype", "project", "labels", "created", "resolutiondate", "assignee", "reporter", "priority", "duedate", "customfield_11342", "customfield_11578", "customfield_11580", "customfield_11588", "customfield_11768", "customfield_12577", "description"]
    };
    n && (s.nextPageToken = n);
    const c = await fetch("https://r2.bashai.io/jira/rest/api/3/search/jql", {
        method: "POST",
        credentials: "omit",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: "Bearer f60350db4573f75632476ab1e039a67515a6c5240fc8c6dd4d9319fe80bef146"
        },
        body: JSON.stringify(s)
    });
    if (!(c.headers.get("content-type") || "").includes("application/json")) throw (await c.text()).includes("Sign In Required") ? new Error("Session expired — please refresh and sign in again.") : new Error(`Non-JSON response (HTTP ${c.status})`);
    const u = await c.json();
    if (!c.ok) throw new Error(String((u == null ? void 0 : u.message) || (u == null ? void 0 : u.error) || `HTTP ${c.status}`));
    return u
}

function Wr(e) {
    var y, x, S, w, C, D, M, A, _, T, V, B;
    const t = e.fields || {},
        o = (((x = (y = t.status) == null ? void 0 : y.statusCategory) == null ? void 0 : x.name) || "").toLowerCase() === "done",
        s = t.duedate || null,
        a = ds(s),
        i = Array.isArray(t.customfield_11588) ? t.customfield_11588.map(P => P == null ? void 0 : P.value).filter(Boolean) : [],
        c = i[0] || "Not yet classified",
        d = Array.isArray(t.customfield_11768) ? t.customfield_11768.map(P => P == null ? void 0 : P.value).filter(Boolean) : [],
        u = typeof t.customfield_12577 == "string" ? [t.customfield_12577] : [],
        p = Array.isArray(t.labels) ? t.labels : [],
        h = [...d, ...u],
        m = c.toLowerCase();
    let k = "Strategic";
    return m.includes("tactical") || m.includes("operational") ? k = "Tactical" : m.includes("not yet") && (k = "Ad hoc"), {
        key: e.key,
        url: `https://duluxgroup.atlassian.net/browse/${e.key}`,
        summary: t.summary || "",
        status: ((S = t.status) == null ? void 0 : S.name) || "Unknown",
        rag: ((w = t.customfield_11578) == null ? void 0 : w.value) || "Unknown",
        issueType: ((C = t.issuetype) == null ? void 0 : C.name) || "Unknown",
        projectKey: ((D = t.project) == null ? void 0 : D.key) || "",
        projectName: ((M = t.project) == null ? void 0 : M.name) || "",
        projectType: ((A = t.project) == null ? void 0 : A.projectTypeKey) || "",
        projectTypeTags: i,
        projectTypeValue: c,
        labels: p,
        startDate: t.customfield_11342 || null,
        endDate: s,
        dueDate: s,
        created: t.created ? String(t.created) : null,
        resolved: t.resolutiondate ? String(t.resolutiondate).slice(0, 10) : null,
        assignee: ((_ = t.assignee) == null ? void 0 : _.displayName) || null,
        reporter: ((T = t.reporter) == null ? void 0 : T.displayName) || null,
        businessContact: typeof t.customfield_11580 == "string" ? t.customfield_11580 : null,
        priority: ((V = t.priority) == null ? void 0 : V.name) || null,
        agingDays: a,
        agingBucket: Bi(a),
        isDone: o,
        isOverdue: !o && a !== null && a > 0,
        stream: "Demand",
        category: k,
        brand: Wi(p, h),
        active: !o,
        projectTag: ((B = p.find(P => P.startsWith("project-"))) == null ? void 0 : B.replace("project-", "")) ?? null,
        projectNameFromDesc: (() => {
            var I, b, E, N, $;
            return ((($ = (N = (E = (b = (I = t.description) == null ? void 0 : I.content) == null ? void 0 : b[0]) == null ? void 0 : E.content) == null ? void 0 : N[0]) == null ? void 0 : $.text) ?? "").trim() || null
        })()
    }
}
const Hs = "5f7a805b25fbdf00685e6cf8";
async function Ki(e) {
    const t = [`(assignee = "${Hs}" OR reporter = "${Hs}")`, 'OR (project in (EPM, DLWLC) AND statusCategory != Done AND ("Brands[Function]" in ("Selleys", "Yates") OR labels in ("selleys", "yates") OR text ~ "Selleys" OR text ~ "Yates"))', 'OR ("Project Type" = "AI")'].join(" "),
        o = await (async () => {
            const m = [];
            let y;
            for (;;) {
                const x = await Br(t, 100, y),
                    S = Array.isArray(x == null ? void 0 : x.issues) ? x.issues : Array.isArray(x) ? x : [];
                if (m.push(...S), S.length === 0 || x != null && x.isLast || (y = x == null ? void 0 : x.nextPageToken, !y)) break
            }
            return m
        })();
    if (o.length === 0) throw new Error("Refresh returned zero tickets; keeping previous dashboard data.");
    const s = o.map(Wr),
        a = new Map;
    for (const m of e.tickets) a.set(m.key, m);
    for (const m of s) a.set(m.key, m);
    const i = Array.from(a.values()),
        c = i.filter(m => m.isDone).length,
        d = i.filter(m => m.active).length,
        u = i.filter(m => m.isOverdue).length,
        p = i.filter(m => ["Initiative", "Epic", "Capability"].includes(m.issueType) || m.category === "Strategic").length,
        h = i.filter(m => (m.projectTypeValue || "").toLowerCase() === "ai").length;
    return {
        ...e,
        summary: {
            ...e.summary,
            generatedAt: new Date().toISOString(),
            owner: {
                name: e.summary.owner.name
            },
            scopeNote: "Your assigned and reported tickets, plus all tickets with Project Type = AI.",
            totals: {
                ...e.summary.totals,
                allTickets: i.length,
                totalInitiatives: p,
                overdueItems: u,
                completed: c,
                activeTickets: d,
                aiProjectTypeTickets: h
            }
        },
        tickets: i
    }
}

function De({
    data: e,
    onSelect: t
}) {
    return r.jsx("div", {
        className: "mt-3 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2",
        children: e.map((n, o) => r.jsxs("button", {
            onClick: () => t(n.name),
            className: "flex items-center justify-between rounded bg-slate-950/60 px-2 py-1 text-slate-200 transition hover:bg-slate-700/60 hover:text-white",
            children: [r.jsxs("div", {
                className: "flex min-w-0 items-center gap-2",
                children: [r.jsx("span", {
                    className: "inline-block h-2.5 w-2.5 rounded-full",
                    style: {
                        backgroundColor: oe[o % oe.length]
                    }
                }), r.jsx("span", {
                    className: "truncate",
                    children: n.name
                })]
            }), r.jsx("span", {
                className: "ml-2 font-semibold text-slate-100",
                children: n.value
            })]
        }, n.name))
    })
}

function Je({
    title: e,
    rows: t,
    columns: n,
    limit: o,
    defaultSortKey: s,
    defaultSortDir: a = "asc"
}) {
    const [i, c] = g.useState(s || ""), [d, u] = g.useState(a), [p, h] = g.useState({}), m = g.useMemo(() => {
        let y = [...t];
        if (y = y.filter(x => n.every(S => {
                const w = (p[S.key] || "").trim().toLowerCase();
                return w ? String(S.value(x) ?? "").toLowerCase().includes(w) : !0
            })), i) {
            const x = n.find(S => S.key === i);
            x && y.sort((S, w) => {
                const C = String(x.value(S) ?? ""),
                    D = String(x.value(w) ?? "");
                if (i === "agingBucket") {
                    const V = ["90+", "61-90", "31-60", "0-30", "Unknown"].indexOf(Ve(C)),
                        B = ["90+", "61-90", "31-60", "0-30", "Unknown"].indexOf(Ve(D));
                    return d === "asc" ? V - B : B - V
                }
                const M = Number(C),
                    A = Number(D);
                if (!Number.isNaN(M) && !Number.isNaN(A) && C !== "" && D !== "") return d === "asc" ? M - A : A - M;
                const _ = Date.parse(C),
                    T = Date.parse(D);
                return !Number.isNaN(_) && !Number.isNaN(T) && C !== "" && D !== "" ? d === "asc" ? _ - T : T - _ : d === "asc" ? C.localeCompare(D) : D.localeCompare(C)
            })
        }
        return o && y.length > o ? y.slice(0, o) : y
    }, [t, n, p, i, d, o]), k = y => {
        if (i !== y) {
            c(y), u("asc");
            return
        }
        u(x => x === "asc" ? "desc" : "asc")
    };
    return r.jsxs("section", {
        className: "rounded-2xl border border-slate-800 bg-slate-900/70 p-4",
        children: [r.jsxs("div", {
            className: "mb-3 flex items-center justify-between",
            children: [r.jsx("h2", {
                className: "text-lg font-semibold text-slate-100",
                children: e
            }), r.jsxs("p", {
                className: "text-xs text-slate-400",
                children: ["Rows: ", m.length]
            })]
        }), r.jsx("div", {
            className: "overflow-x-auto",
            children: r.jsxs("table", {
                className: "w-full text-sm",
                style: {
                    tableLayout: "fixed"
                },
                children: [r.jsx("colgroup", {
                    children: n.map(y => r.jsx("col", {
                        style: {
                            width: y.width ?? "auto"
                        }
                    }, y.key))
                }), r.jsxs("thead", {
                    children: [r.jsx("tr", {
                        className: "border-b border-slate-700 text-left text-slate-300",
                        children: n.map(y => r.jsxs("th", {
                            onClick: () => k(y.key),
                            className: "cursor-pointer whitespace-nowrap px-2 py-2 font-semibold",
                            children: [y.label, i === y.key ? d === "asc" ? " ▲" : " ▼" : " ↕"]
                        }, y.key))
                    }), r.jsx("tr", {
                        className: "border-b border-slate-800",
                        children: n.map(y => r.jsx("th", {
                            className: "px-2 py-2",
                            children: r.jsx("input", {
                                value: p[y.key] || "",
                                onChange: x => h(S => ({
                                    ...S,
                                    [y.key]: x.target.value
                                })),
                                placeholder: "Filter...",
                                className: "w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 outline-none focus:border-cyan-500"
                            })
                        }, y.key))
                    })]
                }), r.jsx("tbody", {
                    children: m.map((y, x) => r.jsx("tr", {
                        className: "border-b border-slate-800 text-slate-200 hover:bg-slate-800/50",
                        children: n.map(S => r.jsx("td", {
                            className: `px-2 py-2 align-top ${S.width?"break-words":"whitespace-nowrap"}`,
                            children: S.render ? S.render(y) : String(S.value(y) ?? "-")
                        }, S.key))
                    }, x))
                })]
            })
        })]
    })
}

function Xs({
    title: e,
    rows: t,
    columns: n,
    onClose: o
}) {
    var s;
    return r.jsx("div", {
        className: "fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4",
        onClick: o,
        children: r.jsxs("div", {
            className: "max-h-[90vh] w-full max-w-6xl overflow-auto rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl",
            onClick: a => a.stopPropagation(),
            children: [r.jsxs("div", {
                className: "flex items-center justify-between border-b border-slate-800 px-5 py-4",
                children: [r.jsxs("h2", {
                    className: "text-lg font-semibold text-slate-100",
                    children: [e, " ", r.jsxs("span", {
                        className: "ml-2 text-sm font-normal text-slate-400",
                        children: ["(", t.length, " tickets)"]
                    })]
                }), r.jsx("button", {
                    onClick: o,
                    className: "rounded-lg px-3 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100",
                    children: "✕"
                })]
            }), r.jsx("div", {
                className: "p-4",
                children: r.jsx(Je, {
                    title: "",
                    rows: t,
                    columns: n,
                    defaultSortKey: (s = n[0]) == null ? void 0 : s.key
                })
            })]
        })
    })
}

function Fi() {
    const [e, t] = g.useState(Ri), [n, o] = g.useState(!1), [s, a] = g.useState(null), [i, c] = g.useState(!1), [d, u] = g.useState(null), [p, h] = g.useState(null), [m, k] = g.useState("dashboard"), [y, x] = g.useState([]);
    g.useEffect(() => {
        const l = "https://r2.bashai.io",
            j = "f60350db4573f75632476ab1e039a67515a6c5240fc8c6dd4d9319fe80bef146";
        fetch(`${l}/config/projects.json`, {
            headers: {
                Authorization: `Bearer ${j}`
            },
            credentials: "omit"
        }).then(se => se.ok ? se.json() : []).then(x).catch(() => {})
    }, []);
    const S = g.useMemo(() => new Map(y.map(l => [l.id, l])), [y]),
        {
            summary: w,
            tickets: C
        } = e,
        D = g.useMemo(Mi, []),
        [M, A] = g.useState("ALL"),
        [_, T] = g.useState("my"),
        [V, B] = g.useState([]),
        [P, I] = g.useState(!1),
        [b, E] = g.useState(null);
    g.useEffect(() => {
        if (_ !== "decisions" || V.length > 0) return;
        I(!0), E(null), (async () => {
            try {
                const j = [];
                let se;
                for (;;) {
                    const ae = await Br("project = PKPI2 AND labels = decision ORDER BY created DESC", 100, se),
                        ct = Array.isArray(ae == null ? void 0 : ae.issues) ? ae.issues : [];
                    if (j.push(...ct), ct.length === 0 || ae != null && ae.isLast || (se = ae == null ? void 0 : ae.nextPageToken, !se)) break
                }
                B(j.map(Wr))
            } catch (j) {
                E(j.message)
            } finally {
                I(!1)
            }
        })()
    }, [_]);
    const N = D.find(l => l.key === M) || D[0],
        $ = l => l.labels.includes("decision"),
        z = g.useMemo(() => {
            const l = C.filter(j => !$(j));
            return N.kind === "all" ? l : l.filter(j => {
                const se = rt(j.startDate) || rt(j.created);
                if (!se) return !1;
                const ae = se.getFullYear(),
                    ct = Mr(se);
                return N.kind === "annual" ? ae === N.year : ae === N.year && ct === N.quarter
            })
        }, [C, N]),
        W = z.filter(l => l.isDone),
        O = (w.owner.name || "").toLowerCase(),
        U = l => !l.assignee || !O || l.assignee.toLowerCase().includes(O) || O.includes(l.assignee.toLowerCase()),
        L = l => !l.businessContact || l.businessContact.toLowerCase().includes("simon") || l.businessContact.toLowerCase().includes("lobascher"),
        F = z.filter(l => l.active && (U(l) || l.key.startsWith("PKPI2-") && L(l))),
        J = z.filter(l => l.key.startsWith("PKPI2-") && l.active && !U(l) && l.businessContact && !L(l)),
        H = z.filter(l => l.active && !l.key.startsWith("PKPI2-") && !U(l)),
        ne = z.filter(l => l.isDone && !l.key.startsWith("PKPI2-") && !U(l)),
        Q = [...J, ...H],
        ie = Pe(F.filter(l => l.key.startsWith("PKPI2-")), l => l.projectNameFromDesc || l.projectTag || "Untagged"),
        v = Pe(F, l => l.brand),
        K = Js(Pe(F, l => l.agingBucket)),
        R = Pe(Q, l => l.brand),
        G = Js(Pe(Q, l => l.agingBucket)),
        te = Pe(Q, l => l.projectNameFromDesc || l.projectTag || "Untagged"),
        re = Pe(W, l => l.brand),
        X = Pe(W, l => (l.resolved || "").slice(0, 7) || "Unknown"),
        je = z.filter(l => ["Initiative", "Epic", "Capability"].includes(l.issueType) || l.category === "Strategic"),
        Oe = z.filter(l => l.isOverdue),
        Le = Oe.length,
        Fe = [{
            key: "key",
            label: "Key",
            value: l => l.key,
            render: l => r.jsx("a", {
                href: l.url,
                target: "_blank",
                rel: "noreferrer",
                className: "font-semibold text-cyan-300 underline",
                children: l.key
            })
        }, {
            key: "summary",
            label: "Summary",
            value: l => l.summary,
            width: "30%"
        }, {
            key: "status",
            label: "Status",
            value: l => l.status
        }, {
            key: "rag",
            label: "RAG",
            value: l => l.rag,
            render: l => r.jsx("span", {
                className: `rounded-full px-2 py-0.5 text-xs font-semibold ${Ht(l.rag)}`,
                children: l.rag
            })
        }, {
            key: "agingDays",
            label: "Aging (days)",
            value: l => ds(l.dueDate ?? l.endDate) ?? ""
        }, {
            key: "agingBucket",
            label: "Aging Bucket",
            value: l => l.agingBucket
        }, {
            key: "endDate",
            label: "End (Due date)",
            value: l => l.dueDate ?? l.endDate ?? ""
        }, {
            key: "assignee",
            label: "Assignee",
            value: l => l.assignee ?? ""
        }, {
            key: "priority",
            label: "Priority",
            value: l => l.priority ?? ""
        }, {
            key: "brand",
            label: "Brand",
            value: l => l.brand
        }, {
            key: "project",
            label: "Project",
            value: l => {
                var j;
                return ((j = S.get(l.projectTag ?? "")) == null ? void 0 : j.name) ?? l.projectNameFromDesc ?? l.projectTag ?? ""
            },
            render: l => {
                const j = S.get(l.projectTag ?? ""),
                    se = (j == null ? void 0 : j.name) ?? l.projectNameFromDesc ?? l.projectTag ?? null;
                if (!se) return r.jsx("span", {
                    className: "text-slate-600",
                    children: "—"
                });
                const ae = (j == null ? void 0 : j.colour) ?? "#94a3b8";
                return r.jsxs("span", {
                    className: "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                    style: {
                        backgroundColor: ae + "33",
                        color: ae
                    },
                    children: [r.jsx("span", {
                        className: "h-1.5 w-1.5 rounded-full shrink-0",
                        style: {
                            backgroundColor: ae
                        }
                    }), se]
                })
            }
        }],
        Kr = [{
            key: "key",
            label: "Key",
            value: l => l.key,
            render: l => r.jsx("a", {
                href: l.url,
                target: "_blank",
                rel: "noreferrer",
                className: "font-semibold text-cyan-300 underline",
                children: l.key
            })
        }, {
            key: "summary",
            label: "Summary",
            value: l => l.summary,
            width: "30%"
        }, {
            key: "status",
            label: "Status",
            value: l => l.status
        }, {
            key: "rag",
            label: "RAG",
            value: l => l.rag,
            render: l => r.jsx("span", {
                className: `rounded-full px-2 py-0.5 text-xs font-semibold ${Ht(l.rag)}`,
                children: l.rag
            })
        }, {
            key: "agingDays",
            label: "Aging (days)",
            value: l => ds(l.dueDate ?? l.endDate) ?? ""
        }, {
            key: "endDate",
            label: "End (Due date)",
            value: l => l.dueDate ?? l.endDate ?? ""
        }, {
            key: "businessContact",
            label: "Contact (Owner)",
            value: l => l.businessContact ?? ""
        }, {
            key: "priority",
            label: "Priority",
            value: l => l.priority ?? ""
        }, {
            key: "brand",
            label: "Brand",
            value: l => l.brand
        }, {
            key: "project",
            label: "Project",
            value: l => {
                var j;
                return ((j = S.get(l.projectTag ?? "")) == null ? void 0 : j.name) ?? l.projectNameFromDesc ?? l.projectTag ?? ""
            },
            render: l => {
                const j = S.get(l.projectTag ?? ""),
                    se = (j == null ? void 0 : j.name) ?? l.projectNameFromDesc ?? l.projectTag ?? null;
                if (!se) return r.jsx("span", {
                    className: "text-slate-600",
                    children: "—"
                });
                const ae = (j == null ? void 0 : j.colour) ?? "#94a3b8";
                return r.jsxs("span", {
                    className: "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                    style: {
                        backgroundColor: ae + "33",
                        color: ae
                    },
                    children: [r.jsx("span", {
                        className: "h-1.5 w-1.5 rounded-full shrink-0",
                        style: {
                            backgroundColor: ae
                        }
                    }), se]
                })
            }
        }],
        Ot = [{
            key: "key",
            label: "Key",
            value: l => l.key,
            render: l => r.jsx("a", {
                href: l.url,
                target: "_blank",
                rel: "noreferrer",
                className: "font-semibold text-violet-300 underline",
                children: l.key
            })
        }, {
            key: "summary",
            label: "Decision",
            value: l => l.summary,
            width: "40%"
        }, {
            key: "businessContact",
            label: "Owner",
            value: l => l.businessContact ?? ""
        }, {
            key: "startDate",
            label: "Date Decided",
            value: l => l.startDate ?? ""
        }, {
            key: "projectNameFromDesc",
            label: "Project",
            value: l => l.projectNameFromDesc ?? ""
        }],
        it = [{
            key: "key",
            label: "Key",
            value: l => l.key,
            render: l => r.jsx("a", {
                href: l.url,
                target: "_blank",
                rel: "noreferrer",
                className: "font-semibold text-cyan-300 underline",
                children: l.key
            })
        }, {
            key: "summary",
            label: "Summary",
            value: l => l.summary,
            width: "30%"
        }, {
            key: "status",
            label: "Status",
            value: l => l.status
        }, {
            key: "rag",
            label: "RAG",
            value: l => l.rag,
            render: l => r.jsx("span", {
                className: `rounded-full px-2 py-0.5 text-xs font-semibold ${Ht(l.rag)}`,
                children: l.rag
            })
        }, {
            key: "endDate",
            label: "End (Due date)",
            value: l => l.dueDate ?? l.endDate ?? ""
        }, {
            key: "resolved",
            label: "Resolved",
            value: l => l.resolved ?? ""
        }, {
            key: "deliveryOutcome",
            label: "Delivered",
            value: l => Ui(l.resolved, l.dueDate ?? l.endDate)
        }, {
            key: "assignee",
            label: "Assignee",
            value: l => l.assignee ?? ""
        }, {
            key: "priority",
            label: "Priority",
            value: l => l.priority ?? ""
        }, {
            key: "brand",
            label: "Brand",
            value: l => l.brand
        }],
        lt = g.useMemo(() => {
            if (!d) return null;
            switch (d) {
                case "initiatives":
                    return {
                        title: "Total Initiatives", rows: je, cols: Fe
                    };
                case "overdue":
                    return {
                        title: "Overdue Tickets", rows: Oe, cols: Fe
                    };
                case "completed":
                    return {
                        title: "Completed Tickets", rows: W, cols: it
                    };
                case "active":
                    return {
                        title: "Active Tickets", rows: F, cols: Fe
                    };
                case "all":
                    return {
                        title: "All Tickets", rows: z, cols: Fe
                    };
                default:
                    return null
            }
        }, [d, z, je, Oe, W, F, Fe, it]),
        ys = async () => {
            o(!0), a(null);
            try {
                const l = await Ki(e);
                t(l)
            } catch (l) {
                a((l == null ? void 0 : l.message) || "Failed to refresh")
            } finally {
                o(!1)
            }
        };
    return g.useEffect(() => {
        (async () => {
            await ys(), c(!0)
        })()
    }, []), r.jsx("div", {
        className: "min-h-screen bg-[radial-gradient(circle_at_20%_0%,#0f2a5a_0%,#030b1f_40%,#020617_100%)] p-4 text-slate-100 md:p-8",
        children: r.jsxs("div", {
            className: "mx-auto max-w-[1500px] space-y-6",
            children: [r.jsxs("header", {
                className: "flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-5",
                children: [r.jsxs("div", {
                    children: [r.jsx("h1", {
                        className: "text-4xl font-bold tracking-tight text-white",
                        children: "Personal Planning Dashboard"
                    }), r.jsxs("div", {
                        className: "mt-3 flex gap-2",
                        children: [r.jsx("button", {
                            onClick: () => k("dashboard"),
                            className: `rounded-lg px-4 py-1.5 text-sm font-semibold transition ${m==="dashboard"?"bg-cyan-600 text-white":"text-slate-400 hover:text-slate-200"}`,
                            children: "Dashboard"
                        }), r.jsx("button", {
                            onClick: () => k("meetings"),
                            className: `rounded-lg px-4 py-1.5 text-sm font-semibold transition ${m==="meetings"?"bg-cyan-600 text-white":"text-slate-400 hover:text-slate-200"}`,
                            children: "Meetings"
                        }), r.jsx("button", {
                            onClick: () => k("reference"),
                            className: `rounded-lg px-4 py-1.5 text-sm font-semibold transition ${m==="reference"?"bg-teal-600 text-white":"text-slate-400 hover:text-slate-200"}`,
                            children: "Reference Docs"
                        })]
                    }), w.scopeNote && r.jsx("p", {
                        className: "mt-1 text-sm text-slate-400",
                        children: w.scopeNote
                    }), r.jsxs("p", {
                        className: "mt-1 text-xs text-slate-500",
                        children: ["Owner: ", w.owner.name, " | Generated: ", new Date(w.generatedAt).toLocaleString()]
                    }), s ? r.jsxs("p", {
                        className: "mt-1 text-xs text-rose-300",
                        children: ["Refresh failed: ", s]
                    }) : null]
                }), r.jsxs("div", {
                    className: "flex flex-wrap items-center gap-3",
                    children: [i ? null : r.jsx("span", {
                        className: "rounded-xl border border-amber-600/50 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200",
                        children: n ? "Loading latest Jira data..." : "Starting data load..."
                    }), r.jsx("button", {
                        onClick: ys,
                        disabled: n,
                        className: "rounded-xl border border-cyan-700 bg-cyan-600/20 px-3 py-2 text-sm font-semibold text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50",
                        children: n ? "Refreshing..." : "Refresh"
                    }), r.jsx("select", {
                        value: M,
                        onChange: l => A(l.target.value),
                        className: "rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200",
                        children: D.map(l => r.jsx("option", {
                            value: l.key,
                            children: l.label
                        }, l.key))
                    }), r.jsx(no, {
                        afterSignOutUrl: "/"
                    })]
                })]
            }), m === "meetings" ? r.jsx(Ii, {}) : null, m === "reference" ? r.jsx(Ci, {}) : null, m === "dashboard" ? r.jsxs(r.Fragment, {
                children: [r.jsxs("section", {
                    className: "grid grid-cols-2 gap-3 md:grid-cols-4",
                    children: [r.jsxs("button", {
                        onClick: () => u("all"),
                        className: "rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left transition hover:border-sky-700 hover:bg-slate-800/70",
                        children: [r.jsx("p", {
                            className: "text-sm text-slate-400",
                            children: "All Tickets"
                        }), r.jsx("p", {
                            className: "mt-1 text-4xl font-bold text-sky-300",
                            children: z.length
                        }), r.jsxs("p", {
                            className: "mt-1 text-xs text-slate-400",
                            children: ["Active: ", z.filter(l => l.active).length, " | Completed: ", W.length]
                        })]
                    }), r.jsxs("button", {
                        onClick: () => u("completed"),
                        className: "rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left transition hover:border-emerald-700 hover:bg-slate-800/70",
                        children: [r.jsx("p", {
                            className: "text-sm text-slate-400",
                            children: "Completed"
                        }), r.jsx("p", {
                            className: "mt-1 text-4xl font-bold text-emerald-300",
                            children: W.length
                        })]
                    }), r.jsxs("button", {
                        onClick: () => u("overdue"),
                        className: "rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left transition hover:border-rose-700 hover:bg-slate-800/70",
                        children: [r.jsx("p", {
                            className: "text-sm text-slate-400",
                            children: "Overdue"
                        }), r.jsx("p", {
                            className: "mt-1 text-4xl font-bold text-rose-300",
                            children: Le
                        })]
                    }), r.jsxs("button", {
                        onClick: () => u("active"),
                        className: "rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left transition hover:border-violet-700 hover:bg-slate-800/70",
                        children: [r.jsx("p", {
                            className: "text-sm text-slate-400",
                            children: "Active"
                        }), r.jsx("p", {
                            className: "mt-1 text-4xl font-bold text-violet-300",
                            children: z.filter(l => l.active).length
                        })]
                    })]
                }), lt ? r.jsx(Xs, {
                    title: lt.title,
                    rows: lt.rows,
                    columns: lt.cols,
                    onClose: () => u(null)
                }) : null, p ? r.jsx(Xs, {
                    title: p.title,
                    rows: p.rows,
                    columns: p.cols ?? Fe,
                    onClose: () => h(null)
                }) : null, r.jsxs("section", {
                    className: "grid grid-cols-1 gap-4 lg:grid-cols-3",
                    children: [_ === "my" && r.jsxs(r.Fragment, {
                        children: [r.jsxs("div", {
                            className: "rounded-2xl border border-slate-800 bg-slate-900/70 p-4",
                            children: [r.jsx("h2", {
                                className: "mb-3 text-lg font-semibold",
                                children: "Brand Scope"
                            }), r.jsx("div", {
                                className: "h-64",
                                children: r.jsx(Se, {
                                    width: "100%",
                                    height: "100%",
                                    children: r.jsxs(Ce, {
                                        children: [r.jsx(Ee, {
                                            data: v,
                                            dataKey: "value",
                                            nameKey: "name",
                                            outerRadius: 90,
                                            cursor: "pointer",
                                            onClick: l => h({
                                                title: `Brand: ${l.name}`,
                                                rows: F.filter(j => j.brand === l.name)
                                            }),
                                            children: v.map((l, j) => r.jsx(Ne, {
                                                fill: oe[j % oe.length]
                                            }, l.name))
                                        }), r.jsx(Te, {})]
                                    })
                                })
                            }), r.jsx(De, {
                                data: v,
                                onSelect: l => h({
                                    title: `Brand: ${l}`,
                                    rows: F.filter(j => j.brand === l)
                                })
                            })]
                        }), r.jsxs("div", {
                            className: "rounded-2xl border border-slate-800 bg-slate-900/70 p-4",
                            children: [r.jsx("h2", {
                                className: "mb-3 text-lg font-semibold",
                                children: "Ticket Aging"
                            }), r.jsx("div", {
                                className: "h-64",
                                children: r.jsx(Se, {
                                    width: "100%",
                                    height: "100%",
                                    children: r.jsxs(Ce, {
                                        children: [r.jsx(Ee, {
                                            data: K,
                                            dataKey: "value",
                                            nameKey: "name",
                                            outerRadius: 90,
                                            cursor: "pointer",
                                            onClick: l => h({
                                                title: `Aging: ${l.name}`,
                                                rows: F.filter(j => Ve(j.agingBucket) === l.name)
                                            }),
                                            children: K.map((l, j) => r.jsx(Ne, {
                                                fill: oe[j % oe.length]
                                            }, l.name))
                                        }), r.jsx(Te, {})]
                                    })
                                })
                            }), r.jsx(De, {
                                data: K,
                                onSelect: l => h({
                                    title: `Aging: ${l}`,
                                    rows: F.filter(j => Ve(j.agingBucket) === l)
                                })
                            })]
                        }), r.jsxs("div", {
                            className: "rounded-2xl border border-slate-800 bg-slate-900/70 p-4",
                            children: [r.jsx("h2", {
                                className: "mb-3 text-lg font-semibold",
                                children: "Project Area"
                            }), r.jsx("div", {
                                className: "h-64",
                                children: r.jsx(Se, {
                                    width: "100%",
                                    height: "100%",
                                    children: r.jsxs(Ce, {
                                        children: [r.jsx(Ee, {
                                            data: ie,
                                            dataKey: "value",
                                            nameKey: "name",
                                            outerRadius: 90,
                                            cursor: "pointer",
                                            onClick: l => h({
                                                title: `Project Area: ${l.name}`,
                                                rows: F.filter(j => (j.projectNameFromDesc || j.projectTag || "Untagged") === l.name)
                                            }),
                                            children: ie.map((l, j) => r.jsx(Ne, {
                                                fill: oe[j % oe.length]
                                            }, l.name))
                                        }), r.jsx(Te, {})]
                                    })
                                })
                            }), r.jsx(De, {
                                data: ie,
                                onSelect: l => h({
                                    title: `Project Area: ${l}`,
                                    rows: F.filter(j => (j.projectNameFromDesc || j.projectTag || "Untagged") === l)
                                })
                            })]
                        })]
                    }), _ === "stakeholder" && r.jsxs(r.Fragment, {
                        children: [r.jsxs("div", {
                            className: "rounded-2xl border border-slate-800 bg-slate-900/70 p-4",
                            children: [r.jsx("h2", {
                                className: "mb-3 text-lg font-semibold",
                                children: "Brand Scope"
                            }), r.jsx("div", {
                                className: "h-64",
                                children: r.jsx(Se, {
                                    width: "100%",
                                    height: "100%",
                                    children: r.jsxs(Ce, {
                                        children: [r.jsx(Ee, {
                                            data: R,
                                            dataKey: "value",
                                            nameKey: "name",
                                            outerRadius: 90,
                                            cursor: "pointer",
                                            onClick: l => h({
                                                title: `Brand: ${l.name}`,
                                                rows: Q.filter(j => j.brand === l.name)
                                            }),
                                            children: R.map((l, j) => r.jsx(Ne, {
                                                fill: oe[j % oe.length]
                                            }, l.name))
                                        }), r.jsx(Te, {})]
                                    })
                                })
                            }), r.jsx(De, {
                                data: R,
                                onSelect: l => h({
                                    title: `Brand: ${l}`,
                                    rows: Q.filter(j => j.brand === l)
                                })
                            })]
                        }), r.jsxs("div", {
                            className: "rounded-2xl border border-slate-800 bg-slate-900/70 p-4",
                            children: [r.jsx("h2", {
                                className: "mb-3 text-lg font-semibold",
                                children: "Ticket Aging"
                            }), r.jsx("div", {
                                className: "h-64",
                                children: r.jsx(Se, {
                                    width: "100%",
                                    height: "100%",
                                    children: r.jsxs(Ce, {
                                        children: [r.jsx(Ee, {
                                            data: G,
                                            dataKey: "value",
                                            nameKey: "name",
                                            outerRadius: 90,
                                            cursor: "pointer",
                                            onClick: l => h({
                                                title: `Aging: ${l.name}`,
                                                rows: Q.filter(j => Ve(j.agingBucket) === l.name)
                                            }),
                                            children: G.map((l, j) => r.jsx(Ne, {
                                                fill: oe[j % oe.length]
                                            }, l.name))
                                        }), r.jsx(Te, {})]
                                    })
                                })
                            }), r.jsx(De, {
                                data: G,
                                onSelect: l => h({
                                    title: `Aging: ${l}`,
                                    rows: Q.filter(j => Ve(j.agingBucket) === l)
                                })
                            })]
                        }), r.jsxs("div", {
                            className: "rounded-2xl border border-slate-800 bg-slate-900/70 p-4",
                            children: [r.jsx("h2", {
                                className: "mb-3 text-lg font-semibold",
                                children: "Project Area"
                            }), r.jsx("div", {
                                className: "h-64",
                                children: r.jsx(Se, {
                                    width: "100%",
                                    height: "100%",
                                    children: r.jsxs(Ce, {
                                        children: [r.jsx(Ee, {
                                            data: te,
                                            dataKey: "value",
                                            nameKey: "name",
                                            outerRadius: 90,
                                            cursor: "pointer",
                                            onClick: l => h({
                                                title: `Project Area: ${l.name}`,
                                                rows: Q.filter(j => (j.projectNameFromDesc || j.projectTag || "Untagged") === l.name)
                                            }),
                                            children: te.map((l, j) => r.jsx(Ne, {
                                                fill: oe[j % oe.length]
                                            }, l.name))
                                        }), r.jsx(Te, {})]
                                    })
                                })
                            }), r.jsx(De, {
                                data: te,
                                onSelect: l => h({
                                    title: `Project Area: ${l}`,
                                    rows: Q.filter(j => (j.projectNameFromDesc || j.projectTag || "Untagged") === l)
                                })
                            })]
                        })]
                    }), _ === "completed" && r.jsxs(r.Fragment, {
                        children: [r.jsxs("div", {
                            className: "rounded-2xl border border-slate-800 bg-slate-900/70 p-4",
                            children: [r.jsx("h2", {
                                className: "mb-3 text-lg font-semibold",
                                children: "Brand Scope"
                            }), r.jsx("div", {
                                className: "h-64",
                                children: r.jsx(Se, {
                                    width: "100%",
                                    height: "100%",
                                    children: r.jsxs(Ce, {
                                        children: [r.jsx(Ee, {
                                            data: re,
                                            dataKey: "value",
                                            nameKey: "name",
                                            outerRadius: 90,
                                            cursor: "pointer",
                                            onClick: l => h({
                                                title: `Brand: ${l.name}`,
                                                rows: W.filter(j => j.brand === l.name)
                                            }),
                                            children: re.map((l, j) => r.jsx(Ne, {
                                                fill: oe[j % oe.length]
                                            }, l.name))
                                        }), r.jsx(Te, {})]
                                    })
                                })
                            }), r.jsx(De, {
                                data: re,
                                onSelect: l => h({
                                    title: `Brand: ${l}`,
                                    rows: W.filter(j => j.brand === l)
                                })
                            })]
                        }), r.jsxs("div", {
                            className: "rounded-2xl border border-slate-800 bg-slate-900/70 p-4",
                            children: [r.jsx("h2", {
                                className: "mb-3 text-lg font-semibold",
                                children: "Resolved By Month"
                            }), r.jsx("div", {
                                className: "h-64",
                                children: r.jsx(Se, {
                                    width: "100%",
                                    height: "100%",
                                    children: r.jsxs(Ce, {
                                        children: [r.jsx(Ee, {
                                            data: X,
                                            dataKey: "value",
                                            nameKey: "name",
                                            outerRadius: 90,
                                            cursor: "pointer",
                                            onClick: l => h({
                                                title: `Resolved: ${l.name}`,
                                                rows: W.filter(j => (j.resolved || "").slice(0, 7) === l.name)
                                            }),
                                            children: X.map((l, j) => r.jsx(Ne, {
                                                fill: oe[j % oe.length]
                                            }, l.name))
                                        }), r.jsx(Te, {})]
                                    })
                                })
                            }), r.jsx(De, {
                                data: X,
                                onSelect: l => h({
                                    title: `Resolved: ${l}`,
                                    rows: W.filter(j => (j.resolved || "").slice(0, 7) === l)
                                })
                            })]
                        })]
                    }), _ === "decisions" && V.length > 0 && (() => {
                        const l = Pe(V, j => j.projectNameFromDesc || j.projectTag || "Untagged");
                        return r.jsx(r.Fragment, {
                            children: r.jsxs("div", {
                                className: "rounded-2xl border border-slate-800 bg-slate-900/70 p-4",
                                children: [r.jsx("h2", {
                                    className: "mb-3 text-lg font-semibold",
                                    children: "By Project"
                                }), r.jsx("div", {
                                    className: "h-64",
                                    children: r.jsx(Se, {
                                        width: "100%",
                                        height: "100%",
                                        children: r.jsxs(Ce, {
                                            children: [r.jsx(Ee, {
                                                data: l,
                                                dataKey: "value",
                                                nameKey: "name",
                                                outerRadius: 90,
                                                cursor: "pointer",
                                                onClick: j => h({
                                                    title: `Project: ${j.name}`,
                                                    rows: V.filter(se => (se.projectNameFromDesc || se.projectTag || "Untagged") === j.name),
                                                    cols: Ot
                                                }),
                                                children: l.map((j, se) => r.jsx(Ne, {
                                                    fill: oe[se % oe.length]
                                                }, j.name))
                                            }), r.jsx(Te, {})]
                                        })
                                    })
                                }), r.jsx(De, {
                                    data: l,
                                    onSelect: j => h({
                                        title: `Project: ${j}`,
                                        rows: V.filter(se => (se.projectNameFromDesc || se.projectTag || "Untagged") === j),
                                        cols: Ot
                                    })
                                })]
                            })
                        })
                    })()]
                }), r.jsxs("div", {
                    className: "rounded-2xl border border-slate-800 bg-slate-900/70",
                    children: [r.jsx("div", {
                        className: "flex border-b border-slate-800",
                        children: [
                            ["my", "My Tickets"],
                            ["stakeholder", "Stakeholder"],
                            ["completed", "Completed"],
                            ["decisions", "Decisions"]
                        ].map(([l, j]) => r.jsx("button", {
                            onClick: () => T(l),
                            className: `px-6 py-3 text-sm font-medium transition-colors ${_===l?"border-b-2 border-cyan-400 text-cyan-300":"text-slate-400 hover:text-slate-200"}`,
                            children: j
                        }, l))
                    }), r.jsxs("div", {
                        className: "p-4",
                        children: [_ === "my" && r.jsx(r.Fragment, {
                            children: r.jsx(Je, {
                                title: "My Tickets",
                                rows: F,
                                columns: Fe,
                                defaultSortKey: "agingDays",
                                defaultSortDir: "desc"
                            })
                        }), _ === "stakeholder" && r.jsxs(r.Fragment, {
                            children: [r.jsx(Je, {
                                title: "Stakeholder Commitments",
                                rows: [...J, ...H],
                                columns: Kr,
                                defaultSortKey: "agingDays",
                                defaultSortDir: "desc"
                            }), r.jsx(Je, {
                                title: "Completed",
                                rows: ne,
                                columns: it,
                                defaultSortKey: "resolved",
                                defaultSortDir: "desc"
                            })]
                        }), _ === "completed" && r.jsx(Je, {
                            title: "Completed Tickets",
                            rows: W,
                            columns: it,
                            defaultSortKey: "resolved",
                            defaultSortDir: "desc"
                        }), _ === "decisions" && (P ? r.jsxs("div", {
                            className: "flex items-center gap-2 py-8 text-slate-400",
                            children: [r.jsx("span", {
                                className: "inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-violet-400"
                            }), "Loading decisions from Jira..."]
                        }) : b ? r.jsxs("div", {
                            className: "space-y-2 py-4",
                            children: [r.jsxs("p", {
                                className: "text-sm text-rose-400",
                                children: ["Failed to load decisions: ", b]
                            }), r.jsx("button", {
                                onClick: () => {
                                    B([]), E(null), T("my"), setTimeout(() => T("decisions"), 50)
                                },
                                className: "text-xs text-violet-400 hover:text-violet-300",
                                children: "Retry"
                            })]
                        }) : r.jsx(Je, {
                            title: "Decisions",
                            rows: V,
                            columns: Ot,
                            defaultSortKey: "created",
                            defaultSortDir: "desc"
                        }))]
                    })]
                })]
            }) : null]
        })
    })
}

function zi() {
    return r.jsxs(r.Fragment, {
        children: [r.jsx(Ga, {
            children: r.jsx("div", {
                style: {
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: "100vh",
                    background: "#0f172a"
                },
                children: r.jsxs("div", {
                    style: {
                        textAlign: "center"
                    },
                    children: [r.jsx("h1", {
                        style: {
                            color: "#f1f5f9",
                            fontSize: "1.5rem",
                            fontWeight: 700,
                            marginBottom: "0.5rem"
                        },
                        children: "Personal Planning Dashboard"
                    }), r.jsx("p", {
                        style: {
                            color: "#94a3b8",
                            marginBottom: "1.5rem"
                        },
                        children: "Sign in to continue"
                    }), r.jsx(eo, {
                        fallbackRedirectUrl: "/"
                    })]
                })
            })
        }), r.jsx($a, {
            children: r.jsx(Fi, {})
        })]
    })
}
const Vi = "pk_live_Y2xlcmsubWFuYWdlLmJhc2hhaS5pbyQ=";
Xt.createRoot(document.getElementById("root")).render(r.jsx(f.StrictMode, {
    children: r.jsx(Pr, {
        publishableKey: Vi,
        children: r.jsx(zi, {})
    })
}));