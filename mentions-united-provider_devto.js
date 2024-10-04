/**
 * Mentions United Provider plugin class for retreiving interaction from DevTo
 * 
 * @author Kristof Zerbe
 * @version 1.0.0
 * @see {@link https://github.com/kristofzerbe/MentionsUnited|GitHub}
 * 
 * API Documentation: https://developers.forem.com/api/v1
 *
 * Options:
 *  - {String} sourceUrl  = URL of the mentioning page on dev.to
 *  - {Number} [sourceId] = ID of dev.to article (only available over API)
 *
  * Supported origins:
 *  - devto
 * 
 * Supported type-verbs:
 *  - comment
 * 
 * Remarks:
 *  - If 'sourceId' is not provided, it will fetched over the published articles list
 */
class MentionsUnitedProvider_DevTo  extends MentionsUnited.Provider {
  key = "DEV.to"; // must be unique across all provider plugins for registration

  options = {
    sourceUrl: "",
    sourceId: 0
  }

  constructor(options) {
    super();
    this.options = {...this.options, ...options};
    this.helper = new MentionsUnited.Helper();

    //check mandatory options
    if (this.options.sourceUrl.length === 0) { throw "'sourceUrl' is missing"; }

    // get sourceId if not provided
    if (this.options.sourceId === 0) { this.#getSourceId(); }
  }

  /**
   * Retrieve comment data from dev.to
   * @returns {Array.<MentionsUnited.Interaction>}
   */
  async retrieve() {
    const msg = `${this.constructor.name}: Retreiving comments for ${this.options.sourceUrl}`;
    console.time(msg);

    const apiResponse = await fetch(this.commentApiUrl());
    const apiData = await apiResponse.json();

    let interactions = this.#processJsonData(apiData);

    console.timeEnd(msg);
    return interactions;
  }

  //////////////////////////////////////////////////////////////////////////////////////////

  commentApiUrl() { return `https://dev.to/api/comments?a_id=${this.options.sourceId}` };

  /**
   * Processes retrieved JSON data into flat array of Interactions 
   * @param {Array.<Object>} entries 
   * @returns {Array.<MentionsUnited.Interaction>}
   */
  #processJsonData(entries) {
    let items = [];
    for (const entry of entries) {
      let interaction = this.#convertToInteraction(entry);
      items.push(interaction);
      if (entry.children?.length > 0) {
        let childItems = this.#processJsonData(entry.children);
        items = items.concat(childItems);
      }
    };
    return items;
  }

  /**
   * Converts specific data object into Interaction
   * @param {Object} entry 
   * @returns {MentionsUnited.Interaction}
   */
  #convertToInteraction(entry) {
    let r = new MentionsUnited.Interaction();

    r.type = entry.type_of;
    r.received = entry.created_at;

    r.source.provider = this.key;
    r.source.origin = "devto";
    r.source.sender = this.key;
    r.source.url = this.options.sourceUrl;
    r.source.id = this.sourceId;

    r.author.name = entry.user.name;
    r.author.avatar = entry.user.profile_image_90;
    r.author.profile = `https://dev.to/${entry.user.username}`;

    r.content.html = entry.body_html;
    
    return r;
  }

  /**
   * Get sourceId from users article list synchronously
   */
  #getSourceId() {

    //get username from article URL
    const userName = new URL(this.options.sourceUrl).pathname.split("/")[1];

    //set api URL and get article data
    const apiUrl = `https://dev.to/api/articles?username=${userName}&per_page=1000`;
    const jsonArticles = this.helper.fetchJsonSync(apiUrl);
    const dataArticle = jsonArticles.filter(a => a.url === this.options.sourceUrl)[0];

    if (dataArticle) {
      this.options.sourceId = dataArticle.id;
    }
  }

}
/**
 * Changelog
 * 
 * 1.0.0  - Initial
 */