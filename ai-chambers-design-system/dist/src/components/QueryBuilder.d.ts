import { type Column, type Query } from "../models/records";
export declare function CompactSelect({ label, value, options, onChange, }: {
    label: string;
    value: string;
    options: {
        value: string;
        label: string;
    }[];
    onChange: (v: string) => void;
}): import("react").JSX.Element;
export declare function QueryBuilder({ value, onChange, columns, depth, }: {
    value: Query;
    onChange: (q: Query) => void;
    columns: Column[];
    depth?: number;
}): import("react").JSX.Element;
