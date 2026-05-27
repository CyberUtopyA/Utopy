import React, { useState } from "react";
import type { FalconStoreItem } from "../types/falcon.store";
import { publishFalconConsultDV } from "./falconpublishdv";

type Props = {
  item: FalconStoreItem | null;
  onClose: () => void;
};

export default function FalconConsultModal({ item, onClose }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);

  if (!item) return null;

  const currentItem: FalconStoreItem = item;

  async function confirm() {
    setSaving(true);
    try {
      await publishFalconConsultDV(currentItem, {
        name,
        phone,
        message,
      });
      setOk(true);

      setTimeout(() => {
        onClose();
      }, 700);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-2xl font-black text-slate-950">Consultar</h3>
          <button
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
          >
            Cerrar
          </button>
        </div>

        {ok ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
            Tu consulta fue enviada correctamente.
          </div>
        ) : (
          <div className="space-y-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
            />

            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Tu teléfono"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
            />

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escribí tu consulta"
              className="min-h-[130px] w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
            />

            <button
              onClick={confirm}
              disabled={saving}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
            >
              {saving ? "Enviando..." : "Enviar consulta"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}