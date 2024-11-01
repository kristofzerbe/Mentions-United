/**
 * Mentions United Renderer plugin for displaying Interactions as a list
 * 
 * @author Kristof Zerbe
 * @version 1.0.1
 * @see {@link https://github.com/kristofzerbe/MentionsUnited|GitHub}
 * 
 * Options:
 *  - {String} placeholderId    = ID of the element which will be replaced with list of interactions
 *  - {String} [skipTypes]      = Comma-separated list of type-verbs to skip 
 *  - {Callback} [afterRender]  = Function to call after the generated HTML was inserted into the page
 */
class MentionsUnitedRenderer_List extends MentionsUnited.Renderer {
  key = "list"; // must be unique across all renderer plugins for registration

  options = { 
    placeholderId: "",
    skipTypes: "",
    afterRender: undefined
  }

  constructor(options) {
    super();
    this.options = {...this.options, ...options};
    this.helper = new MentionsUnited.Helper();

    //check mandatory options
    if (this.options.placeholderId.length === 0) { throw "'placeholderId' is missing"; }
  }

  /**
   * Renders Interactions
   * @param {Array.<MentionsUnited.Interaction>} interactions
   */
  render(interactions) {

    //set and check placeholder where the anchor element will be inserted
    let placeholder = document.getElementById(this.options.placeholderId);
    if (!placeholder) { throw "No placeholder defined to replace with all the interactions"; }

    //filter types when specified and content is null
    if (this.options.skipTypes.length > 0) {
      interactions = interactions.filter((ia) => {
        return !(this.options.skipTypes.toLowerCase().includes(ia.type.toLowerCase()));
      });
    }

    const templates = new this.#Templates(this.helper);

    let listElement = this.helper.createElementFromHtml(templates.list());

    let iaElements = [];
    for (let ia of interactions) {
      try {
        //get template HTML and convert to element
        let html = (typeof templates[ia.type] === 'function') 
          ? templates[ia.type](ia)
          : templates["unknown"](ia);
        
        let element = this.helper.createElementFromHtml(html);
        iaElements.push(element); 

      } catch (error) { console.error(error); }
    }

    if (iaElements.length > 0) {
      listElement.append(...iaElements);
      placeholder.replaceWith(listElement);
    } else {
      placeholder.remove();
    }

    //call afterRender callback, if defined
    if (typeof this.options.afterRender === "function") {
      this.options.afterRender();
    }
  }

  //////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Template class to hold methods for composing the HTML
   */
  #Templates = class Templates {

    constructor(helper) {
      this.helper = helper;
    }

    /**
     * Composes a wrapper for the interactions
     * @returns {HTML}
     */
    list() {
      return this.helper.fillLiteralTemplate(
        `
        <div class="interactions-list"></div>
        `,
        {}
      );  
    }
    
    /**
     * Composes an unknown type, whose template method does not yet exist
     * @param {MentionsUnited.Interaction} ia 
     * @returns {HTML}
     */
    unknown(ia) {
      ia.typeWord = "? (" + ia.type + ")";

      let parts = {};
      parts.received = (ia.received) 
        ? this.#part_received(ia) 
        : "";
      parts.source = this.#part_origin(ia);
      parts.content = (ia.content.text) 
        ? this.#part_content_text_excerpt(ia) 
        : "";
      
      return this.#base(ia, parts);
    }
    
    /**
     * Composes a LIKE
     * @param {MentionsUnited.Interaction} ia 
     * @returns {HTML}
     */
    like(ia) {
      ia.typeWord = "liked";

      let parts = {};
      parts.received = (ia.received) 
        ? this.#part_received(ia) 
        : "";
      
      return this.#base(ia, parts);
    }

    /**
     * Composes a REPLY
     * @param {MentionsUnited.Interaction} ia 
     * @returns {HTML}
     */
    reply(ia) {
      ia.typeWord = "replied";
      
      let parts = {};
      parts.received = this.#part_received(ia);
      parts.source = this.#part_origin(ia);
      parts.content = (ia.content.html) 
        ? this.#part_content_html(ia) 
        : this.#part_content_text(ia);

      return this.#base(ia, parts);
    }
    
    /**
     * Composes a COMMENT (same as REPLY)
     * @param {MentionsUnited.Interaction} ia 
     * @returns {HTML}
     */
    comment(ia) {
      ia.typeWord = "commented";

      let parts = {};
      parts.received = this.#part_received(ia);
      parts.source = this.#part_origin(ia);
      parts.content = (ia.content.html) 
        ? this.#part_content_html(ia) 
        : this.#part_content_text(ia);

      return this.#base(ia, parts);
    }

    /**
     * Composes a MENTION
     * @param {MentionsUnited.Interaction} ia 
     * @returns {HTML}
     */
    mention(ia) {
      ia.typeWord = "mentioned";

      let parts = {};
      parts.received = this.#part_received(ia);
      parts.source = this.#part_origin(ia);
      parts.content = (ia.content.text) 
        ? this.#part_content_text_excerpt(ia) 
        : "";

      return this.#base(ia, parts);
    }
    
    /**
     * Composes a REPOST
     * @param {MentionsUnited.Interaction} ia 
     * @returns {HTML}
     */
    repost(ia) {
      ia.typeWord = "reposted";

      let parts = {};
      parts.received = this.#part_received(ia);
      parts.source = (ia.source.origin === "web") 
        ? this.#part_origin(ia) 
        : "";

      return this.#base(ia, parts);
    }
    
    /**
     * Composes a BOOKMARK
     * @param {MentionsUnited.Interaction} ia 
     * @returns {HTML}
     */
    bookmark(ia) {
      ia.typeWord = "bookmarked";

      let parts = {};
      parts.received = (ia.received) 
        ? this.#part_received(ia) 
        : "";
      
      return this.#base(ia, parts);
    }

    /**
     * Base template for Interaction
     * @param {MentionsUnited.Interaction} ia
     * @param {HTML} parts 
     * @returns {String}
     */
    #base(ia, parts) {
      return this.helper.fillLiteralTemplate(
        `
        <div class="interaction origin-${ia.source.origin} type-${ia.type} ${(ia.isOwn) ? "isown" : ""}">
          ${this.#part_avatar(ia)}
          <span class="meta">
            ${this.#part_author(ia)}
            <span class="type">${ia.typeWord}</span>
            ${parts.received ?? ""}
            ${parts.source ?? ""}
          </span>
          ${parts.content ?? ""}
        </div>
        `,
        ia
      );
    }

    /**
     * Template part for avatar
     * @param {MentionsUnited.Interaction} ia 
     * @returns 
     */
    #part_avatar(ia) {
      if (ia.author.profile) {
        return this.helper.fillLiteralTemplate(
          `
          <a class="avatar" href="${ia.author.profile}">
            <img src="${ia.author.avatar}" alt="${ia.author.name}" width="16px" height="16px" />
          </a>
          `,
          ia
        );  
      } else {
        return this.helper.fillLiteralTemplate(
          `
          <span class="avatar">
            <img src="${ia.author.avatar}" alt="${ia.author.name}" width="16px" height="16px" />
          </span>
          `,
          ia
        );
      }
    }

    /**
     * Template part for author
     * @param {MentionsUnited.Interaction} ia 
     */
    #part_author(ia) {
      let authorName = ia.author.name; 

      //replace emoji codes with img elements
      if (ia.author.emojis?.length > 0) {
        for (const emoji of ia.author.emojis) {
          const e = `<img class="emoji" src="${emoji.url}" alt="${emoji.code}" />`;
          authorName = authorName.replace(":" + emoji.code + ":", e);
        }
      }

      if (ia.author.profile) {
        return this.helper.fillLiteralTemplate(
          `
          <a class="author" href="${ia.author.profile}">${authorName}</a>
          `,
          ia
        );  
      } else {
        return this.helper.fillLiteralTemplate(
          `
          <span class="author">${authorName}</span>
          `,
          ia
        );
      }
    }

    /**
     * Template part for received date
     * @param {MentionsUnited.Interaction} ia 
     */
    #part_received(ia) {
      return this.helper.fillLiteralTemplate(
        `
        <span class="prep">on</span>
        <span class="received">${ia.received.toLocaleString('en-GB', { year:"numeric", month:"short", day:"numeric"})}</span>
        `,
        ia
      );
    }

    /**
     * Template part for origin with or without title
     * @param {MentionsUnited.Interaction} ia 
     */
    #part_origin(ia) {

      if (ia.source.origin === "web") {
        return this.helper.fillLiteralTemplate(
          `
          <span class="prep">in</span>
          <a href="${ia.source.url}" class="title">${ia.source.title}</a>
          <span class="prep">on</span>
          <span class="origin">${ia.source.sender}</span>
          `,
          ia
        );
      } else {
        if (ia.source.title && ia.source.title.length != 0) {
          return this.helper.fillLiteralTemplate(
            `
            <span class="prep">on</span>
            <a href="${ia.source.url}" class="origin">${this.helper.capitalize(ia.source.origin) + " (" + ia.source.title + ")"}</a>
            `,
            ia
          );
        } else {
          return this.helper.fillLiteralTemplate(
            `
            <span class="prep">on</span>
            <a href="${ia.source.url}" class="origin">${this.helper.capitalize(ia.source.origin)}</a>
            `,
            ia
          );
        }
      }

    }

    /**
     * Template part for HTML content
     * @param {MentionsUnited.Interaction} ia 
     */
    #part_content_html(ia) {
      return this.helper.fillLiteralTemplate(
        `
        <div class="content">${ia.content.html}</div>
        `,
        ia
      );  
    }

    /**
     * Template part for text content
     * @param {MentionsUnited.Interaction} ia 
     */
    #part_content_text(ia) {
      return this.helper.fillLiteralTemplate(
        `
        <div class="content">
          <p>${ia.content.text}</p>
        </div>
        `,
        ia
      );  
    }

    /**
     * Template part for text content, excerpt only
     * @param {MentionsUnited.Interaction} ia 
     */
    #part_content_text_excerpt(ia) {
      return this.helper.fillLiteralTemplate(
        `
        <div class="content">
          <p>${ia.content.text?.slice(0,255) + " ..."}</p>
        </div>
        `,
        ia
      );  
    }

  }

}
/**
 * Changelog
 * 
 * 1.0.0 - Initial
 * 1.0.1 - Refactored '#part_origin', including title depending on origin
 */