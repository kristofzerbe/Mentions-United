/**
 * Mentions United Provider plugin class for retreiving interaction from DevTo
 * 
 * @author Kristof Zerbe
 * @version 2.1.0
 * @see {@link https://github.com/kristofzerbe/MentionsUnited|GitHub}
 * 
 * API Documentation: https://developers.forem.com/api/v1
 *
 * Options:
 *  - {String} syndicationUrl  = Full URL of the dev.to post
 *  - {Number} [syndicationId] = ID of dev.to post (only available over API)
 *
  * Supported origins:
 *  - devto
 * 
 * Supported type-verbs:
 *  - comment
 * 
 * Remarks:
 *  - If 'syndicationId' is not provided, it will fetched over the published articles list
 */
class MentionsUnitedProvider_DevTo  extends MentionsUnited.Provider {
  key = "DEV.to"; // must be unique across all provider plugins for registration

  options = {
    syndicationUrl: "",
    syndicationId: 0
  }

  constructor(options) {
    super();
    this.options = {...this.options, ...options};
    this.helper = new MentionsUnited.Helper();

    //check mandatory options
    if (this.options.syndicationUrl.length === 0) { throw "'syndicationUrl' is missing"; }

    // get syndicationId if not provided
    if (this.options.syndicationId === 0) { 
      this.#getSyndicationId(); 
    }
  }

  /**
   * Retrieve comment data from dev.to
   * @returns {Array.<MentionsUnited.Interaction>}
   */
  async retrieve(args) {
    const msg = `${this.constructor.name}: Retreiving comments for ${this.options.syndicationUrl} (${this.options.syndicationId})`;
    args.fStart(msg);

    const apiResponse = await fetch(this.commentApiUrl());
    const apiData = await apiResponse.json();

    let interactions = this.#processJsonData(apiData);

    args.fEnd(msg);
    return interactions;
  }

  //////////////////////////////////////////////////////////////////////////////////////////

  commentApiUrl() { return `https://dev.to/api/comments?a_id=${this.options.syndicationId}` };

  /**
   * Processes retrieved JSON data into flat array of Interactions 
   * @param {Array.<Object>} entries 
   * @returns {Array.<MentionsUnited.Interaction>}
   */
  #processJsonData(entries) {
    let items = [];
    try {
      for (const entry of entries) {
        let interaction = this.#convertToInteraction(entry);
        items.push(interaction);
        if (entry.children?.length > 0) {
          let childItems = this.#processJsonData(entry.children);
          items = items.concat(childItems);
        }
      };        
    } catch (error) { console.warn(error); }
    return items;
  }

  /**
   * Converts specific data object into Interaction
   * @param {Object} entry 
   * @returns {MentionsUnited.Interaction}
   */
  #convertToInteraction(entry) {
    let r = new MentionsUnited.Interaction();

    r.syndication.url = this.options.syndicationUrl;
    r.syndication.title = "";

    r.type = entry.type_of;
    r.received = entry.created_at;

    r.source.provider = this.key;
    r.source.origin = "devto";
    r.source.sender = this.key;
    r.source.url = this.options.syndicationUrl;
    r.source.id = this.syndicationId;
    r.source.title = "";

    r.author.name = entry.user.name;
    r.author.avatar = entry.user.profile_image_90;
    r.author.profile = `https://dev.to/${entry.user.username}`;

    r.content.html = entry.body_html;
    
    return r;
  }

  /**
   * Get syndicationId from users article list synchronously
   */
  #getSyndicationId() {

    //get username from article URL
    const userName = new URL(this.options.syndicationUrl).pathname.split("/")[1];

    //set api URL and get article data
    const apiUrl = `https://dev.to/api/articles?username=${userName}&per_page=1000`;
    const jsonArticles = this.helper.fetchJsonSync(apiUrl);
    const dataArticle = jsonArticles.filter(a => a.url === this.options.syndicationUrl)[0];

    if (dataArticle) {
      this.options.syndicationId = dataArticle.id;
    }
  }

}
/**
 * Changelog
 * 
 * 1.0.0 - Initial
 * 1.0.1 - No data fix -> #processJsonData: entries not iterable
 * 1.0.2 - Set source.title explicit to empty
 * 2.0.0 - Changed option names due to risk of confusion
 *       - Introducting interaction.syndication
 * 2.1.0 - Introducing retrieve arguments
 *       - Outsourced time measurement
 */