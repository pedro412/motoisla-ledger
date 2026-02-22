"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type TrendPoint = {
  date: string;
  ventaNeta: number;
  utilidad: number;
};

type CapitalPoint = {
  date: string;
  capital: number;
};

type PaymentMixPoint = {
  metodo: string;
  ventas: number;
};

type CapitalSplitPoint = {
  concepto: string;
  monto: number;
};

export function ChartsPanel({
  trendData,
  capitalEvolutionData,
  paymentMixData,
  capitalSplitData,
}: {
  trendData: TrendPoint[];
  capitalEvolutionData: CapitalPoint[];
  paymentMixData: PaymentMixPoint[];
  capitalSplitData: CapitalSplitPoint[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="card">
        <h2>Tendencia: venta neta vs utilidad</h2>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => `$${formatMoneyFromUnknown(value)}`} />
              <Legend />
              <Line type="monotone" dataKey="ventaNeta" name="Venta neta" stroke="#0284c7" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="utilidad" name="Utilidad" stroke="#059669" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2>Evolución de capital</h2>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={capitalEvolutionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => `$${formatMoneyFromUnknown(value)}`} />
              <Legend />
              <Line type="monotone" dataKey="capital" name="Capital después" stroke="#0f766e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2>Método de cobro (número de ventas)</h2>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <PieChart>
              <Tooltip formatter={(value) => `${Math.round(toNumber(value))} venta(s)`} />
              <Legend />
              <Pie data={paymentMixData} dataKey="ventas" nameKey="metodo" outerRadius={95}>
                {paymentMixData.map((entry, idx) => (
                  <Cell key={`${entry.metodo}-${idx}`} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2>Composición financiera actual</h2>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={capitalSplitData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="concepto" />
              <YAxis />
              <Tooltip formatter={(value) => `$${formatMoneyFromUnknown(value)}`} />
              <Legend />
              <Bar dataKey="monto" name="Monto">
                {capitalSplitData.map((entry, idx) => (
                  <Cell key={`${entry.concepto}-${idx}`} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatMoneyFromUnknown(value: unknown) {
  return formatMoney(toNumber(value));
}

const PIE_COLORS = ["#0284c7", "#0d9488", "#ca8a04", "#7c3aed", "#db2777"];
const BAR_COLORS = ["#0284c7", "#0d9488", "#16a34a"];
