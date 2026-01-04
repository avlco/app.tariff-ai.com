export function createPageUrl(pageName, params) {
    let url = '/' + pageName.replace(/ /g, '-');
    
    if (params && Object.keys(params).length > 0) {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                searchParams.append(key, String(value));
            }
        });
        const queryString = searchParams.toString();
        if (queryString) {
            url += '?' + queryString;
        }
    }
    
    return url;
}