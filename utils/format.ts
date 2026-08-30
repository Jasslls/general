export function money(n: number | null | undefined): string {
    if (n == null || isNaN(n)) return "$0";
    
    // Si es un número entero exacto, formateamos sin decimales
    if (n % 1 === 0) {
        return n.toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        });
    }

    // Si tiene decimales, mostramos 2
    return n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}
