/**
 * Mentions United main class
 * 
 * @author Kristof Zerbe
 * @version 1.0.1
 * @see {@link https://github.com/kristofzerbe/MentionsUnited|GitHub}
 * 
 * This script relies on two different types of plug-ins: PROVIDER and RENDERER, 
 * whose necessary structure is defined by the following two classes.
 *
 * A Provider plugin retrieves mentions of a page from a service and brings them into 
 * the common form of an INTERACTION (see class structure below). 
 * A Renderer plugin generates HTML from all the collected INTERACTIONS and inserts 
 * it into the page.
 * 
 * Settings:
 *  - ownerName {String}  = The owner/creator of the page ... your name
 */
class MentionsUnited {

  /** 
   * Basic structure where Provider plugins must extend from
   */
  static Provider = class Provider {
    key = ""; // unique key across all provider plugins for registration
    options = {}; // options for the plugin
    constructor(options) {}; // constructor that takes the needed options
    async retrieve() {}; // main method to retrieve interactions from provider
  }

  /** 
   * Basic structure where Renderer plugins must extend from
   */
  static Renderer = class Renderer {
    key = ""; // unique key across all renderer plugins for registration
    options = {}; // options for the plugin
    constructor(options) {}; // constructor that takes the needed options
    render(interactions) {}; // main method to render interactions via templates
  }

  /**
   * Representation of an interaction
   */
  static Interaction = class Interaction {
    type; // type verb of the interaction (comment, like, reply, repost, mention, ...)
    received; // date the interaction was created or received

    static Source = class Source {
      provider; // pick-up point of the interaction
      origin; // origin system of the interaction
      sender; // transfer system of the interaction
      url; // URL of the original interaction
      id; // ID of the original interaction
      title; // title of the original interaction
    }
    source;

    static Author = class Author {
      name; // authors name
      avatar; // authors avatar image URL
      profile; // authors profile URL
    }
    author;

    static Content = class Content {
      html;
      text;
    }
    content; 

    constructor() {
      this.source = new Interaction.Source();
      this.author = new Interaction.Author();
      this.content = new Interaction.Content();
    } 
  }

  //////////////////////////////////////////////////////////////////////////////////////////

  settings = {
    ownerName: ""
  };

  #providers = {};
  #renderers = {};
  #interactions = [];

  constructor(settings, plugins) {
    this.settings = { ...this.settings, ...settings };
    this.helper = new MentionsUnited.Helper();

    // register passed plugins directly
    if (plugins) {
      for (let p of plugins) { this.register(p) };
    }
  }

  /**
   * Registers a MentionsUnited plugin
   * @param {MentionsUnited plugin class} plugin 
   */
  register(plugin) {
    let { key } = plugin;

    if (plugin instanceof MentionsUnited.Provider) {
      let pCount = this.helper.countAttributesByName(this.#providers, key);
      if (pCount > 0) key += "_" + (pCount + 1);
      this.#providers[key] = plugin;
    }

    if (plugin instanceof MentionsUnited.Renderer) {
      this.#renderers[key] = plugin;
    }

  }

  /**
   * Calls the 'retrieve' method of all registered Provider plugins to get array of Interactions
   */
  load() {
    let fetches = [];

    for (const p in this.#providers) {
      fetches.push(this.#providers[p].retrieve());
    }

    return Promise.all(fetches)
      .then((results) => {
        for (const res of results) {
          this.#interactions = this.#interactions.concat(res);
        }
        
        //final processing of Interaction
        for (let ia of this.#interactions) {

          //ensure author.name and author.avatar
          if (!ia.author.name) { ia.author.name = "Unknown"; }
          this.helper.resolveAvatar(ia.author);

          //determine if author of Interaction is owner
          ia.isOwn = ia.author.name.startsWith(this.settings.ownerName);

          //convert into real date
          if (ia.received) ia.received = new Date(ia.received);
        };

        // sorting interactions based on the received date, while setting undefined to the end
        this.#interactions.sort((a, b) => { 
          const aDate = a.received !== undefined ? a.received : Infinity;
          const bDate = b.received !== undefined ? b.received : Infinity;
          return aDate - bDate; 
        });
        
        console.info("Interactions:", this.#interactions);
      })
      .catch(console.error)
  }

  /**
   * Calls the 'render' method of all registered Renderer plugins to display Interactions 
   */
  show() {

    return new Promise((resolve) => {
      for (const p in this.#renderers) {
        this.#renderers[p].render(this.#interactions);
      }
      resolve(this.#interactions.length);  
    });

  }

  //////////////////////////////////////////////////////////////////////////////////////////

  /** 
   * Helper class with some tools, if needed
   */
  static Helper = class Helper {

    /**
     * Fetches JSON data from url synchronously
     * @param {String} url 
     * @returns {JSON}
     */
    fetchJsonSync(url) {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", url, false);
      xhr.send();
      if (xhr.status === 200) {
        const json = JSON.parse(xhr.responseText);
        return json;
      }
    }

    /**
     * Resolves the existence of an avatar image of the author
     * @param {MentionsUnited.Interaction.Author} author 
     */
    resolveAvatar(author) {
      this.checkImageExists(author.avatar, () => {
        author.avatar = 
          "https://api.dicebear.com/9.x/initials/svg" + 
            "?seed=" + encodeURIComponent(author.name) +
            "&size=128" + 
            "&scale=75" + 
            "&fontWeight=600";
      });
    }

    /**
     * Check if remote image exists, with callback on error
     * @param {String} url 
     * @param {Callback} callback
     */
    checkImageExists(url, callback) {
      if (url?.length > 0) {
        var img = new Image();
        img.onload = () => { return; }
        img.onerror = (error) => {
          console.error(error);
          callback();
        } 
        img.src = url;  
      } else {
        callback();
      }
    }
   
    /**
     * Converts HTML into element
     * @param {String} html 
     * @returns {Element}
     */
    createElementFromHtml(html) {
      let e = document.createElement("template");
      e.innerHTML = html.trim();
      return e.content.firstChild;
    }

    /**
     * Dynamic Tag Function for creating tagged template literals
     * @param {Array} templateString 
     * @param {Array} templateVars 
     * @returns {Function}
     */
    fillLiteralTemplate(templateString, templateVars) {
      var func = new Function(...Object.keys(templateVars),
        "return `" + templateString + "`.trim();"
      );
      return func(...Object.values(templateVars));
    }

    /**
     * Captialize word
     * @param {String} value 
     * @returns 
     */
    capitalize(value) {
      return (value && value[0].toUpperCase() + value.slice(1)) || "";
    }

    /**
     * Count attributes of given object by name which includes namePart
     * @param {Object} obj 
     * @param {String} namePart 
     */
    countAttributesByName(obj, namePart) {
      let count = 0;
      for(var name in obj) {
        if (name.includes(namePart)) count += 1;
      }
      return count;
    }
   
  }

}
/**
 * Changelog
 * 
 * 1.0.0 - Initial
 * 1.0.1 - new helper 'countAttributesByName' for making keys unique in constructor, 
 *         when Provider plugin is registered multiple times with different URL's
 */