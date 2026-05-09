import Parser from 'rss-parser';
const rssParser = new Parser();
function generateId() {
    return `rss_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
class RssFeedAdapter {
    id = 'generic.rss';
    name = 'RSS';
    availableFormats = [
        { format: 'text/html', priority: 1, fetchRequired: true, extension: 'html' },
    ];
    configSchema = {
        id: 'adapter.rss',
        sections: [
            {
                id: 'general',
                fields: [
                    {
                        key: 'url',
                        type: 'text',
                        defaultValue: '',
                        validation: { required: true },
                    },
                    {
                        key: 'titleFilter',
                        type: 'text',
                        defaultValue: '',
                    },
                ],
            },
        ],
    };
    async fetch(options) {
        const { url, titleFilter } = options.config;
        const feed = await rssParser.parseURL(url);
        let items = feed.items.slice(0, options.limit ?? 50);
        if (options.since) {
            items = items.filter(item => {
                const pubDate = item.pubDate || item.isoDate;
                return pubDate ? new Date(pubDate) > options.since : true;
            });
        }
        if (titleFilter) {
            const regex = new RegExp(titleFilter, 'i');
            items = items.filter(item => regex.test(item.title || ''));
        }
        const entries = items.map(item => ({
            id: item.guid || item.link || generateId(),
            externalIds: item.link ? { url: item.link } : undefined,
            title: item.title || 'Untitled',
            abstract: item.contentSnippet || item.summary || '',
            authors: item.creator
                ? item.creator.split(',').map(a => a.trim())
                : item.author
                    ? [item.author]
                    : [],
            publishedAt: new Date(item.pubDate || item.isoDate || Date.now()),
            availableFormats: ['text/html'],
            sourceUrl: item.link,
            metadata: {
                feedTitle: feed.title,
                categories: item.categories,
            },
        }));
        return {
            entries,
            nextCursor: null,
            hasMore: false,
        };
    }
    resolveDownload(externalIds) {
        const url = externalIds.url;
        if (!url) {
            return null;
        }
        return {
            url,
            format: 'text/html',
            priority: 1,
        };
    }
    async fetchFormat(entryId, format) {
        if (format !== 'text/html') {
            throw new Error(`RSS only supports HTML format, got: ${format}`);
        }
        const response = await fetch(entryId, {
            headers: {
                'User-Agent': 'Yandu/1.0 (Academic Paper Aggregator)',
            },
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch HTML: ${response.status}`);
        }
        return response.blob();
    }
}
export default {
    name: '@yandu/plugin-feed-rss',
    version: '1.0.0',
    register(system) {
        const adapter = new RssFeedAdapter();
        system.capabilities.register({ type: 'feed', id: adapter.id, name: adapter.name }, adapter);
    },
};
