/**
 * Mentions United Provider plugin class for retreiving interactions from Peertube
 * 
 * @author Kristof Zerbe
 * @version 1.0.0
 * @see {@link https://github.com/kristofzerbe/MentionsUnited|GitHub} 
 * 
 * API Documentation: https://docs.joinpeertube.org/api-rest-reference.html
 * 
 * Options:
 *  - {String} syndicationUrl     = Full URL of the Peertube post
 *  - {String} [syndicationTitle] = Title of the Peertube post, if multiple syndications of original post
 * 
 * Supported origins:
 *  - peertube
 * 
 * Supported type-verbs:
 *  - comment
 * 
 * Remarks:
 *  - 
*/
class MentionsUnitedProvider_Peertube extends MentionsUnited.Provider {
  key = ""; // will be set via syndicationUrl in constructor (must be unique across all provider plugins for registration)
  
  options = {
    syndicationUrl: "",
    syndicationTitle: ""
  }

  constructor(options) {
    super();
    this.options = {...this.options, ...options};

    //check mandatory options
    if (this.options.syndicationUrl.length === 0) { throw "'syndicationUrl' is missing"; }

    //get needed information from syndicationUrl
    let peertubeUrl = new URL(this.options.syndicationUrl);
    this.key = peertubeUrl.hostname;
    this.sourceId = peertubeUrl.pathname.split("/").pop();
    
    //set API endpoint
    this.options.apiBaseUrl = peertubeUrl.origin;
  }

  /**
   * Retrieve data from Peertube
   * @returns {Array.<MentionsUnited.Interaction>}
   */
  async retrieve(args) {
    const msg = `${this.constructor.name}: Retreiving interactions for '${this.options.syndicationUrl}'`;
    args.fStart(msg);
    
    const apiResponse = await fetch(this.commentApiUrl());
    const apiData = await apiResponse.json();

    //Replace AUTHOR block with data from account API in all interactions
    let authorApiUrls = new Set();
    apiData.items.forEach((item) => {
      item.author.name = item.author.url.split("/").pop();
      authorApiUrls.add(this.accountApiUrl(item.author.name));
    });
    let authors = await this.#fetchAuthors([...authorApiUrls]);
    apiData.items.forEach((item) => {
      item.author = authors.find(author => author.name === item.author.name);
    });

    let interactions = this.#processJsonData(apiData.items);

    args.fCount();
    
    args.fEnd(msg);
    return interactions;

  }

  //////////////////////////////////////////////////////////////////////////////////////////
  
  commentApiUrl() { return `${this.options.apiBaseUrl}/feeds/video-comments.json?videoId=${this.sourceId}` };
  accountApiUrl(name) { return `${this.options.apiBaseUrl}/api/v1/accounts/${name}` };

  /**
   * Fetches authors from Peertube API
   * @param {String} url - API URL for authors
   * @returns {Object} - JSON object with author data
   */
  async #fetchAuthors(urls) {
    try {
      const requests = urls.map(url => fetch(url));
      const responses = await Promise.all(requests);
  
      const data = await Promise.all(responses.map(response => {
        return response.json();
      }));

      return data;
    } catch (e) { console.error(e); }
  }


  /**
   * Processes retrieved JSON data into flat array of Interaction 
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

    r.syndication.url = this.options.syndicationUrl;
    r.syndication.title = this.options.syndicationTitle;

    r.type = "comment";
    r.received = entry.date_modified;

    r.source.provider = this.key;
    r.source.origin = "peertube";
    r.source.sender = this.key;
    r.source.url = entry.url;
    r.source.id = "";
    r.source.title = "";

    r.author.name = entry.author.displayName;
    r.author.avatar = entry.author.avatars[0].fileUrl;
    r.author.profile = entry.author.url;

    r.content.html = entry.content_html;
    
    return r;
  }

}
/**
 * Changelog
 * 
 * 1.0.0 - Initial
 */