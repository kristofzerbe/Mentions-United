/**
 * Mentions United Provider plugin class for retreiving webmentions from webmention.io
 * 
 * @author Kristof Zerbe
 * @version 2.1.0
 * @see {@link https://github.com/kristofzerbe/MentionsUnited|GitHub}
 * 
 * API Documentation: https://github.com/aaronpk/webmention.io
 * 
 * Options:
 *  - {String} originalUrl         = Full URL of the original page mentioned (Permalink)
 *  - {Boolean} [tryResolveTitle]  = Should titles of mentioning pages be resolved
 * 
 * Supported origins:
 *  - webmention (native)
 *  - mastodon (via brid.gy)
 *  - bluesky (via bridgy)
 *  - flickr (via bridgy)
 *  - github (via bridgy)
 *  - reddit (via bridgy)
 *  - twitter (via bridgy, deprecated)
 *  - facebook (via bridgy, deprecated)
 * 
 * Supported type-verbs:
 *  - reply
 *  - like
 *  - repost
 *  - bookmark
 *  - mention
 */
class MentionsUnitedProvider_Webmentions extends MentionsUnited.Provider {
  key = "webmention.io"; // must be unique across all provider plugins for registration
  
  options = {
    originalUrl: "",
    tryResolveTitle: false
  }

  constructor(options) {
    super();
    this.options = {...this.options, ...options};
    this.helper = new MentionsUnited.Helper();

    //check mandatory options
    if (this.options.originalUrl.length === 0) { throw "'originalUrl' is missing"; }
  }

  /**
   * Retrieve data from webmention.io
   * @returns {Array.<MentionsUnited.Interaction>}
   */
  async retrieve(args) {
    const msg = `${this.constructor.name}: Retreiving webmentions for '${this.options.originalUrl}'`;
    args.fStart(msg);

    const apiResponse = await fetch(this.webmentionApiUrl());
    const apiData = await apiResponse.json();

    let interactions = this.#processJsonData(apiData.children);

    //Interaction adjustments depending on type ...
    for (let r of interactions) {

      //Resolve emojis in Mastodon author names
      if (r.source.origin === "mastodon") { this.#resolveCustomEmojis(r); }

      //Resolve page title for webmentions from web pages, if wanted
      if (r.source.origin === "webmention" && this.options.tryResolveTitle) { 
        await this.#resolvePageTitle(r); 
      }
    };

    args.fEnd(msg);
    return interactions;
  }

  //////////////////////////////////////////////////////////////////////////////////////////

  webmentionApiUrl() { return `https://webmention.io/api/mentions.jf2?target=${encodeURIComponent(this.options.originalUrl)}&per-page=1000&sort-dir=up`; };

  /**
   * Processes retrieved JSON data into flat array of Interactions 
   * @param {Array.<Object>} entries
   * @returns {Array.<MentionsUnited.Interaction>}
   */
  #processJsonData(entries) {
    return entries.map((item) => {
      return this.#convertToInteraction(item);
    });
  }
  
  /**
   * Converts specific data object into Interaction
   * @param {Object} entry 
   * @returns {MentionsUnited.Interaction}
   */
  #convertToInteraction(entry) {
    let r = new MentionsUnited.Interaction();

    const sourceUrl = new URL(entry["wm-source"]);

    r.syndication.url = "";
    r.syndication.title = "";

    r.type = this.#translatePropertyVerb(entry["wm-property"]);
    r.received = entry["published"] ?? entry["wm-received"];

    r.source.provider = this.key;
    r.source.origin = "webmention"; // default
    r.source.sender = sourceUrl.hostname;
    r.source.url = sourceUrl.href;
    r.source.id = entry["wm-id"];

    r.author.name = entry.author?.name || "Somebody";
    r.author.avatar = entry.author.photo;
    r.author.profile = entry.author.url;

    r.content.html = entry.content?.html;
    r.content.text = entry.content?.text;

    // replace default, if it comes from bridgy
    if (r.source.sender === "brid.gy") {
      const bridgyPath = sourceUrl.pathname.split("/");
      r.source.origin = bridgyPath[2]; //mastodon, flickr, github, reddit, bluesky, etc
    }

    return r;
  }

  #emojiBuffer = {};
  /**
   * Resolves custom emojis in author names via the respective Mastodon instance with image URL 
   * @param {MentionsUnited.Interaction} interaction 
   * 
   * Remarks:
   *  - Emoji data are fetched asynchronously and the result is buffered 
   *    to avoid identical subsequent requests
   *  - Found emojis are stored for later for composing the author HTML
   */
  async #resolveCustomEmojis(interaction) {

    const regexp = /:(?<shortcode>[a-z]\w+):/g;
    const matches = [...interaction.author.name.matchAll(regexp)];

    if (matches.length > 0) {
      let result = [];

      let instance = new URL(interaction.author.profile).hostname;
      let emojiApiUrl = `https://${instance}/api/v1/custom_emojis`;

      let emojiData;
      if(instance in this.#emojiBuffer) {
        emojiData = this.#emojiBuffer[instance]; //get api data from buffer
      } else {
        emojiData = this.helper.fetchJsonSync(emojiApiUrl); //fetch emoji data from instance    
        this.#emojiBuffer[instance] = emojiData; //... and store in buffer
      }

      for (const m of matches) {
        let emojiCode = m.groups.shortcode;
        let emoji = emojiData.filter((e) => e.shortcode === emojiCode)[0];
        if (emoji) {
          result.push({
            code: emojiCode,
            url: emoji.url
          });
        }
      };

      interaction.author.emojis = result;
    }
  }

  /**
   * Resolves the title of the web page which mentions
   * @param {MentionsUnited.Interaction} interaction 
   */
  async #resolvePageTitle(interaction) {

    if (interaction.source.url) {
      let title = "a post";

      try {
        const pageData = await fetch(interaction.source.url, {
          signal: AbortSignal.timeout(3000)
        }).then(response => response.text());
        
        if (pageData) {
          let regexp = /<title>(?<title>(.*?))<\/title>/g;
          let titleMatches = regexp.exec(pageData);
          if (titleMatches.groups.title) {
            title = titleMatches.groups.title;
          }
        }
      } catch (error) { console.error(error); }
      
      interaction.source.title = title;
    }
  }

  /**
   * Translates an IndieWeb property verb into a type verb
   * @param {String} wmProperty 
   * @returns 
   */
  #translatePropertyVerb(wmProperty) {
    switch (wmProperty) {
      case "in-reply-to": return "reply";  
      case "like-of": return "like";  
      case "repost-of": return "repost";  
      case "bookmark-of": return "bookmark";  
      case "mention-of": return "mention";  
      default: return wmProperty;
    }
  }
  
}
/**
 * Changelog
 * 
 * 1.0.0 - Initial
 * 2.0.0 - Changed option name due to risk of confusion
 *       - Changed source.origin default to 'webmention'
 *       - Introducting interaction.syndication
 * 2.1.0 - Introducing retrieve arguments
 *       - Outsourced time measurement
 */